"""Deye Cloud Open API Client.

Implements verified Deye Cloud OpenAPI specifications:
https://india-developer.deyecloud.com:443/
Features token caching, bounded exponential backoff with jitter, non-retryable error detection,
and strict timeout management.
"""

import asyncio
import hashlib
import logging
import random
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import httpx

from app.core.config import settings

logger = logging.getLogger("solarmind.integrations.deye")


class DeyeAPIError(Exception):
    """Base exception for Deye Cloud API errors."""

    def __init__(self, message: str, status_code: int = 500, response_body: Optional[Any] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.response_body = response_body


class DeyeAuthenticationError(DeyeAPIError):
    """Raised when Deye credentials fail authentication (401/403)."""
    pass


class DeyeRateLimitError(DeyeAPIError):
    """Raised when Deye API rate limits are encountered (429)."""
    pass


class DeyeCloudClient:
    """Low-level HTTP client for Deye Cloud Developer OpenAPI."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        app_id: Optional[str] = None,
        app_secret: Optional[str] = None,
        email: Optional[str] = None,
        password: Optional[str] = None,
        timeout: float = 12.0,
        max_retries: int = 3,
        base_backoff: float = 0.5,
        max_backoff: float = 4.0,
    ):
        self.base_url = (base_url or settings.DEYE_API_BASE_URL).rstrip("/")
        self.app_id = app_id or settings.DEYE_APP_ID
        self.app_secret = app_secret or settings.DEYE_APP_SECRET
        self.email = email or settings.DEYE_EMAIL
        self.password = password or settings.DEYE_PASSWORD
        self.timeout = timeout
        self.max_retries = max_retries
        self.base_backoff = base_backoff
        self.max_backoff = max_backoff

        self._access_token: Optional[str] = None
        self._token_expiry_epoch: float = 0.0
        self._token_lock = asyncio.Lock()

    @property
    def is_configured(self) -> bool:
        """Check if all required Deye API credentials are provided."""
        return bool(self.app_id and self.app_secret and self.email and self.password)

    def _hash_password(self, password: str) -> str:
        """Deye API requires password string to be SHA256 hashed."""
        return hashlib.sha256(password.encode("utf-8")).hexdigest()

    async def get_access_token(self, force_refresh: bool = False) -> str:
        """Retrieve active bearer token with thread-safe caching and proactive refresh."""
        if not self.is_configured:
            raise DeyeAuthenticationError("Deye Cloud API credentials are not configured.", status_code=401)

        now = time.time()
        # Return valid cached token if within validity window (buffer 300s before expiry)
        if not force_refresh and self._access_token and now < self._token_expiry_epoch:
            return self._access_token

        async with self._token_lock:
            # Re-check inside lock
            if not force_refresh and self._access_token and time.time() < self._token_expiry_epoch:
                return self._access_token

            auth_url = f"{self.base_url}/v1.0/account/token"
            payload = {
                "appId": self.app_id,
                "appSecret": self.app_secret,
                "email": self.email,
                "password": self._hash_password(self.password),
            }

            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.post(auth_url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        token = data.get("accessToken") or data.get("data", {}).get("accessToken")
                        if not token:
                            raise DeyeAuthenticationError(f"Malformed token response: {data}", status_code=502)
                        expires_in = data.get("expiresIn", 7200)
                        self._access_token = token
                        self._token_expiry_epoch = time.time() + max(60, expires_in - 300)
                        logger.info("Successfully acquired Deye Cloud OpenAPI access token.")
                        return self._access_token
                    elif resp.status_code in (401, 403):
                        raise DeyeAuthenticationError(f"Deye authentication rejected: {resp.text}", status_code=resp.status_code)
                    elif resp.status_code == 429:
                        raise DeyeRateLimitError("Rate limit exceeded during Deye authentication.", status_code=429)
                    else:
                        raise DeyeAPIError(f"Deye token request failed ({resp.status_code}): {resp.text}", status_code=resp.status_code)
            except (DeyeAuthenticationError, DeyeRateLimitError):
                raise
            except Exception as exc:
                raise DeyeAPIError(f"Failed to connect to Deye auth endpoint: {exc}")

    async def _request_with_retry(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json_body: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Execute HTTP request with bounded exponential backoff and jitter."""
        token = await self.get_access_token()
        url = f"{self.base_url}{endpoint}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        attempt = 0
        while attempt <= self.max_retries:
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.request(
                        method=method,
                        url=url,
                        headers=headers,
                        params=params,
                        json=json_body,
                    )

                    if resp.status_code == 200:
                        data = resp.json()
                        # Deye API returns code 0 or 200 on business success
                        code = data.get("code")
                        if code is not None and code not in (0, 200, "0", "200"):
                            msg = data.get("msg") or data.get("message") or "Unknown error"
                            if code in (401, "401", 10001):
                                # Token expired or invalid, refresh once
                                if attempt == 0:
                                    logger.warning("Deye token rejected in body (code=%s). Refreshing token...", code)
                                    token = await self.get_access_token(force_refresh=True)
                                    headers["Authorization"] = f"Bearer {token}"
                                    attempt += 1
                                    continue
                                raise DeyeAuthenticationError(f"Deye business error ({code}): {msg}", status_code=401)
                            raise DeyeAPIError(f"Deye API returned error code {code}: {msg}", status_code=400, response_body=data)
                        return data

                    # Handle 401 Unauthorized (expired token)
                    if resp.status_code == 401 and attempt < self.max_retries:
                        logger.warning("Received 401 from Deye API. Refreshing token and retrying...")
                        token = await self.get_access_token(force_refresh=True)
                        headers["Authorization"] = f"Bearer {token}"
                        attempt += 1
                        continue

                    # Non-retryable client errors
                    if resp.status_code in (400, 403, 404, 422):
                        raise DeyeAPIError(f"Deye API client error ({resp.status_code}): {resp.text}", status_code=resp.status_code)

                    # Rate limiting (429) or Server errors (5xx) -> Backoff & Retry
                    if resp.status_code == 429 or resp.status_code >= 500:
                        if attempt == self.max_retries:
                            if resp.status_code == 429:
                                raise DeyeRateLimitError(f"Deye rate limit exceeded: {resp.text}", status_code=429)
                            raise DeyeAPIError(f"Deye server error ({resp.status_code}): {resp.text}", status_code=resp.status_code)

            except (DeyeAuthenticationError, DeyeRateLimitError):
                raise
            except (httpx.TimeoutException, httpx.NetworkError, httpx.RemoteProtocolError) as exc:
                if attempt == self.max_retries:
                    raise DeyeAPIError(f"Network error connecting to Deye ({url}): {exc}")

            attempt += 1
            if attempt <= self.max_retries:
                # Exponential backoff with jitter
                sleep_duration = min(self.max_backoff, (self.base_backoff * (2 ** (attempt - 1))) + random.uniform(0.1, 0.5))
                logger.info("Retrying Deye API request to %s (attempt %d/%d) in %.2fs", endpoint, attempt, self.max_retries, sleep_duration)
                await asyncio.sleep(sleep_duration)

        raise DeyeAPIError(f"Max retries exceeded for {url}")

    # -----------------------------------------------------------------------
    # Verified DeyeCloud OpenAPI Endpoints
    # -----------------------------------------------------------------------

    async def get_station_list(self, page: int = 1, size: int = 50) -> Dict[str, Any]:
        """Query solar power stations (plants) registered in DeyeCloud."""
        return await self._request_with_retry(
            method="POST",
            endpoint="/v1.0/station/list",
            json_body={"page": page, "size": size},
        )

    async def get_device_list(self, station_id: Optional[str] = None, page: int = 1, size: int = 50) -> Dict[str, Any]:
        """Query inverter devices associated with an optional station ID."""
        body: Dict[str, Any] = {"page": page, "size": size}
        if station_id:
            body["stationId"] = station_id
        return await self._request_with_retry(
            method="POST",
            endpoint="/v1.0/device/list",
            json_body=body,
        )

    async def get_device_latest_data(self, device_sn: str) -> Dict[str, Any]:
        """Query real-time electrical metrics for an inverter serial number."""
        return await self._request_with_retry(
            method="POST",
            endpoint="/v1.0/device/data/latest",
            json_body={"deviceSn": device_sn},
        )

    async def get_device_history_data(
        self,
        device_sn: str,
        start_time: datetime,
        end_time: datetime,
    ) -> Dict[str, Any]:
        """Query historical generation time-series records."""
        return await self._request_with_retry(
            method="POST",
            endpoint="/v1.0/device/data/history",
            json_body={
                "deviceSn": device_sn,
                "startTime": start_time.strftime("%Y-%m-%d %H:%M:%S"),
                "endTime": end_time.strftime("%Y-%m-%d %H:%M:%S"),
            },
        )

    async def get_station_alarm_list(
        self,
        station_id: Optional[str] = None,
        device_sn: Optional[str] = None,
        page: int = 1,
        size: int = 50,
    ) -> Dict[str, Any]:
        """Query active and historical alarm events from Deye stations."""
        body: Dict[str, Any] = {"page": page, "size": size}
        if station_id:
            body["stationId"] = station_id
        if device_sn:
            body["deviceSn"] = device_sn
        return await self._request_with_retry(
            method="POST",
            endpoint="/v1.0/station/alarm/list",
            json_body=body,
        )
