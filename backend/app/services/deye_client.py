"""Deye Cloud Open API Client Integration.

Supports authentication and real-time telemetry syncing from Deye Cloud:
https://india-developer.deyecloud.com:443/
"""

import hashlib
import logging
import time
from typing import Any, Dict, List, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger("solarmind.services.deye")


class DeyeCloudClient:
    """Client for interacting with Deye Cloud Open API."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        app_id: Optional[str] = None,
        app_secret: Optional[str] = None,
        email: Optional[str] = None,
        password: Optional[str] = None,
    ):
        self.base_url = (base_url or settings.DEYE_API_BASE_URL).rstrip("/")
        self.app_id = app_id or settings.DEYE_APP_ID
        self.app_secret = app_secret or settings.DEYE_APP_SECRET
        self.email = email or settings.DEYE_EMAIL
        self.password = password or settings.DEYE_PASSWORD
        self._access_token: Optional[str] = None
        self._token_expiry: float = 0.0

    @property
    def is_configured(self) -> bool:
        """Check if required credentials are configured."""
        return bool(self.app_id and self.app_secret and self.email and self.password)

    def _hash_password(self, password: str) -> str:
        """Deye API expects SHA256 hashed password string."""
        return hashlib.sha256(password.encode("utf-8")).hexdigest()

    async def authenticate(self) -> Optional[str]:
        """Authenticate with Deye Cloud Open API and retrieve bearer access token."""
        if not self.is_configured:
            logger.info("Deye Cloud API credentials not configured. Operating in simulated/manual mode.")
            return None

        # Return cached token if valid
        if self._access_token and time.time() < self._token_expiry:
            return self._access_token

        auth_url = f"{self.base_url}/v1.0/account/token"
        payload = {
            "appId": self.app_id,
            "appSecret": self.app_secret,
            "email": self.email,
            "password": self._hash_password(self.password),
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(auth_url, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    self._access_token = data.get("accessToken")
                    expires_in = data.get("expiresIn", 7200)
                    self._token_expiry = time.time() + max(0, expires_in - 300)
                    logger.info("Successfully authenticated with Deye Cloud Open API.")
                    return self._access_token
                else:
                    logger.warning("Deye authentication failed with status %d: %s", response.status_code, response.text)
                    return None
        except Exception as exc:
            logger.error("Error connecting to Deye Cloud API at %s: %s", self.base_url, exc)
            return None

    async def fetch_latest_device_data(self, device_sn: str) -> Optional[Dict[str, Any]]:
        """Fetch latest telemetry metrics for an inverter serial number from Deye Cloud."""
        token = await self.authenticate()
        if not token:
            return None

        url = f"{self.base_url}/v1.0/device/data/latest"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        params = {"deviceSn": device_sn}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, headers=headers, params=params)
                if response.status_code == 200:
                    return response.json().get("data")
                else:
                    logger.warning("Failed to fetch Deye device data for %s: %s", device_sn, response.text)
                    return None
        except Exception as exc:
            logger.error("Error querying Deye device %s: %s", device_sn, exc)
            return None


deye_client = DeyeCloudClient()
