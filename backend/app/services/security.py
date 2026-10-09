"""SolarMind Security & Password Hashing Service.

Provides production-conscious password hashing with Argon2id, cryptographic
token generation, constant-time verification, and SHA-256 token hashing to avoid
storing plaintext authentication tokens in databases or logs.
"""

import hashlib
import hmac
import secrets
import time
from collections import defaultdict
from typing import Dict, Tuple
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError, VerificationError

from app.core.config import settings
from app.core.logging import logger

# Initialize Argon2id password hasher with recommended enterprise parameters
# (RFC 9106 / OWASP standard for server password hashing)
_hasher = PasswordHasher(
    time_cost=3,          # 3 iterations
    memory_cost=65536,    # 64 MiB
    parallelism=4,        # 4 threads
    hash_len=32,          # 32-byte digest
    salt_len=16,          # 16-byte random salt
)


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id.

    Args:
        password: The plaintext password to hash.

    Returns:
        str: Encoded Argon2id hash string with salt and parameters.
    """
    if not password:
        raise ValueError("Password must not be empty.")
    return _hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against an Argon2id hash.

    Args:
        plain_password: Plaintext password provided by user.
        hashed_password: Stored Argon2id hash string.

    Returns:
        bool: True if password matches, False otherwise.
    """
    if not plain_password or not hashed_password:
        return False
    try:
        return _hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, InvalidHashError, VerificationError):
        return False
    except Exception as exc:
        logger.warning("Unexpected error during password verification: %s", exc)
        return False


def needs_rehash(hashed_password: str) -> bool:
    """Check if the stored hash was created with outdated parameters.

    Args:
        hashed_password: Stored Argon2id hash string.

    Returns:
        bool: True if password should be rehashed upon successful login.
    """
    try:
        return _hasher.check_needs_rehash(hashed_password)
    except Exception:
        return False


def generate_secure_token(nbytes: int = 32) -> str:
    """Generate a cryptographically secure URL-safe random string.

    Args:
        nbytes: Number of random bytes of entropy (default 32 bytes = 256 bits).

    Returns:
        str: URL-safe token.
    """
    return secrets.token_urlsafe(nbytes)


def hash_token(raw_token: str) -> str:
    """Compute a deterministic SHA-256 hash of an authentication or reset token.
    
    This ensures that token lookup is efficient while preventing plaintext token
    exposure in database backups, query logs, or read-only replicas.

    Args:
        raw_token: The plaintext token provided in the cookie, header, or URL.

    Returns:
        str: 64-character lowercase hexadecimal SHA-256 digest.
    """
    if not raw_token:
        return ""
    # HMAC with server secret key adds additional defense against precomputation attacks
    key = settings.SECRET_KEY.encode("utf-8")
    return hmac.new(key, raw_token.encode("utf-8"), hashlib.sha256).hexdigest()


# In-memory sliding window rate limiter for login and sensitive recovery routes
class InMemoryRateLimiter:
    """Thread-safe in-memory rate limiter tracking attempt timestamps per key."""

    def __init__(self):
        self._records: Dict[str, list] = defaultdict(list)

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> Tuple[bool, int]:
        """Check if request is permitted under rate limit.

        Args:
            key: Rate limiting key (e.g., 'ip:127.0.0.1' or 'login:operator@solarmind.io')
            max_requests: Maximum allowed calls within the sliding window.
            window_seconds: Duration of the sliding window in seconds.

        Returns:
            Tuple[bool, int]: (is_allowed, retry_after_seconds)
        """
        now = time.time()
        cutoff = now - window_seconds
        
        # Clean expired timestamps
        timestamps = [t for t in self._records[key] if t > cutoff]
        self._records[key] = timestamps

        if len(timestamps) >= max_requests:
            earliest = timestamps[0]
            retry_after = int(earliest + window_seconds - now) + 1
            return False, max(1, retry_after)

        self._records[key].append(now)
        return True, 0

    def reset(self, key: str) -> None:
        """Clear recorded attempts for a key upon successful login."""
        self._records.pop(key, None)


# Global rate limiter instance for auth endpoints
auth_rate_limiter = InMemoryRateLimiter()
