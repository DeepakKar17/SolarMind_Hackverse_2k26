"""
SolarMind Photo Storage & Hardened File Validation Service.

Handles image file validation, MIME verification, content integrity decoding,
path-traversal protection, server-side unique filename generation, and safe storage.
"""

from datetime import datetime, timezone
import io
import logging
import os
from pathlib import Path
import re
import time
from typing import Optional, Tuple
from uuid import uuid4
from PIL import Image

from app.core.config import settings

logger = logging.getLogger("solarmind.services.photo_storage")

ALLOWED_MIME_TYPES = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

MAX_ALLOWED_FILE_SIZE = settings.MAX_PHOTO_SIZE_BYTES  # 10 MB


class PhotoStorageError(Exception):
    """Base exception for photo storage and validation failures."""
    pass


class InvalidImageFormatError(PhotoStorageError):
    """Raised when file content is not a supported or decodable image."""
    pass


class FileSizeExceededError(PhotoStorageError):
    """Raised when uploaded file exceeds maximum configured size limit."""
    pass


class SecurityPathTraversalError(PhotoStorageError):
    """Raised when an uploaded filename attempts path traversal or directory escaping."""
    pass


class PhotoStorageService:
    """Service providing secure storage, validation, and retrieval for site inspection photos."""

    def __init__(self, base_upload_dir: Optional[str] = None):
        self._upload_dir = Path(base_upload_dir or settings.UPLOAD_DIR).resolve()
        self._ensure_storage_directory()

    def _ensure_storage_directory(self) -> None:
        """Ensures the controlled upload directory exists on filesystem."""
        try:
            self._upload_dir.mkdir(parents=True, exist_ok=True)
        except Exception as exc:
            logger.error("Failed to create photo storage directory %s: %s", self._upload_dir, exc)

    def validate_and_store_photo(
        self,
        file_bytes: bytes,
        original_filename: str,
        content_type: Optional[str] = None,
    ) -> Tuple[str, str, int, str]:
        """
        Validates image content, enforces security bounds, and saves file.

        Args:
            file_bytes: Raw binary content of uploaded file.
            original_filename: Client-supplied original filename.
            content_type: Optional client-reported MIME type.

        Returns:
            Tuple of (relative_storage_path, sanitized_original_filename, file_size_bytes, verified_mime_type).

        Raises:
            SecurityPathTraversalError: If filename contains path traversal syntax.
            FileSizeExceededError: If payload exceeds max size.
            InvalidImageFormatError: If file is corrupted or not a valid image.
        """
        # 1. Size Validation
        size_bytes = len(file_bytes)
        if size_bytes == 0:
            raise InvalidImageFormatError("Uploaded file is empty (0 bytes).")
        if size_bytes > MAX_ALLOWED_FILE_SIZE:
            max_mb = MAX_ALLOWED_FILE_SIZE / (1024 * 1024)
            raise FileSizeExceededError(f"File size ({size_bytes / (1024*1024):.2f} MB) exceeds maximum permissible limit of {max_mb:.0f} MB.")

        # 2. Path Traversal & Security Sanitization
        self._check_path_traversal(original_filename)
        safe_orig_name = self._sanitize_filename(original_filename)

        # 3. Content Decoding and PIL Integrity Verification
        try:
            img = Image.open(io.BytesIO(file_bytes))
            img_format = (img.format or "").upper()
            img.verify()  # Verify image header and byte structure

            # Map PIL format to MIME
            format_map = {
                "JPEG": "image/jpeg",
                "PNG": "image/png",
                "WEBP": "image/webp",
            }
            verified_mime = format_map.get(img_format)
            if not verified_mime:
                raise InvalidImageFormatError(f"Unsupported image format '{img_format}'. Allowed: JPEG, PNG, WebP.")
        except Exception as exc:
            if isinstance(exc, InvalidImageFormatError):
                raise
            logger.warning("PIL failed to decode image: %s", exc)
            raise InvalidImageFormatError(f"Corrupted or invalid image content: {exc}") from exc

        # 4. Generate Server-Side Unique Filename
        ext = ALLOWED_MIME_TYPES.get(verified_mime, "jpg")
        unique_name = f"photo_{uuid4().hex[:16]}_{int(time.time())}.{ext}"
        target_path = self._upload_dir / unique_name

        # 5. Write to Controlled Storage Directory
        try:
            with open(target_path, "wb") as f:
                f.write(file_bytes)
        except Exception as exc:
            logger.error("Filesystem write failure for photo %s: %s", target_path, exc)
            raise PhotoStorageError(f"Failed to persist file to storage: {exc}") from exc

        # Return relative storage path (e.g. 'uploads/photos/photo_xyz.jpg')
        # Crucial: NEVER expose absolute OS filesystem paths in API outputs
        relative_path = f"{settings.UPLOAD_DIR}/{unique_name}"
        return relative_path, safe_orig_name, size_bytes, verified_mime

    def read_photo_bytes(self, relative_path: str) -> Tuple[bytes, str]:
        """
        Safely reads file content from storage by resolving within upload directory.

        Returns:
            Tuple of (file_bytes, mime_type).
        """
        # Strip directory prefix and resolve relative to upload directory
        filename = os.path.basename(relative_path)
        safe_path = (self._upload_dir / filename).resolve()

        # Enforce that resolved path resides strictly inside upload dir
        if not str(safe_path).startswith(str(self._upload_dir)):
            raise SecurityPathTraversalError("Access denied: Resolved path outside controlled storage directory.")

        if not safe_path.exists():
            raise FileNotFoundError(f"Photo file not found at storage target.")

        ext = safe_path.suffix.lower().lstrip(".")
        ext_to_mime = {
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "webp": "image/webp",
        }
        mime = ext_to_mime.get(ext, "image/jpeg")

        with open(safe_path, "rb") as f:
            data = f.read()

        return data, mime

    @staticmethod
    def _check_path_traversal(filename: str) -> None:
        """Rejects filenames containing path traversal sequences or null bytes."""
        if not filename:
            return
        if "\0" in filename:
            raise SecurityPathTraversalError("Null byte injection detected in filename.")
        if ".." in filename or "/" in filename or "\\" in filename:
            raise SecurityPathTraversalError("Path traversal sequence detected in filename.")

    @staticmethod
    def _sanitize_filename(filename: str) -> str:
        """Strips unsafe characters, preserving basic alphanumeric basename."""
        base = os.path.basename(filename).strip()
        cleaned = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", base)
        return cleaned or "inspection_photo.jpg"


# Global singleton instance
photo_storage_service = PhotoStorageService()
