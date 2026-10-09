"""Security utilities, filename sanitization, and secret masking."""

import os
import re
from typing import Optional


def sanitize_filename(filename: Optional[str]) -> str:
    """Sanitize user-provided filename to prevent directory traversal and null byte injection."""
    if not filename:
        return "unnamed_file"

    # Remove path components
    basename = os.path.basename(filename)
    # Strip null bytes and directory traversal symbols
    cleaned = basename.replace("\x00", "").replace("..", "").replace("/", "").replace("\\", "")
    # Restrict to safe characters
    cleaned = re.sub(r"[^\w\s\.\-]", "_", cleaned).strip()
    return cleaned or "safe_file"


def mask_secret(secret: Optional[str]) -> Optional[str]:
    """Mask secret token or password for safe logging."""
    if not secret:
        return None
    if len(secret) <= 4:
        return "****"
    return f"{secret[:2]}****{secret[-2:]}"
