import json
from typing import Any, Dict, List, Optional, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "SolarMind Backend"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"  # 'development', 'test', 'staging', 'production'
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"  # 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'

    # Security & Docs
    DOCS_ENABLED: Optional[bool] = None  # None -> enabled in dev/test, disabled in production
    MAX_REQUEST_BODY_BYTES: int = 15 * 1024 * 1024  # 15 MB max payload

    # Geo Photo AI & File Storage
    UPLOAD_DIR: str = "uploads/photos"
    MAX_PHOTO_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB max image size
    VISION_MODEL_ENABLED: bool = False  # Set to True when a trained model weights file is present
    VISION_MODEL_PATH: Optional[str] = None

    # CORS Configuration
    ALLOWED_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # Database Configuration
    DATABASE_URL: str = "sqlite:///./data/solarmind.db"

    # Authentication & Session Security
    SECRET_KEY: str = "solarmind-insecure-secret-key-change-in-production-2026"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours standard session
    REMEMBER_ME_EXPIRE_DAYS: int = 14  # 14 days if remember-me is checked
    SESSION_COOKIE_NAME: str = "solarmind_session"
    SESSION_COOKIE_SECURE: bool = False  # Set True in production (HTTPS)
    SESSION_COOKIE_HTTPONLY: bool = True
    SESSION_COOKIE_SAMESITE: str = "lax"  # 'lax', 'strict', 'none'
    MAX_FAILED_LOGIN_ATTEMPTS: int = 5
    ACCOUNT_LOCKOUT_MINUTES: int = 15
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 30
    EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS: int = 24

    # Initial Admin Provisioning (Controlled Environment / CLI setup)
    INITIAL_ADMIN_EMAIL: Optional[str] = "admin@solarmind.io"
    INITIAL_ADMIN_PASSWORD: Optional[str] = "SolarAdmin#2026!"
    INITIAL_ADMIN_FULL_NAME: str = "SolarMind Administrator"

    # Email Delivery Configuration
    EMAIL_DELIVERY_ENABLED: bool = False
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAIL_FROM: str = "noreply@solarmind.io"

    # Deye Cloud Open API Configuration (https://india-developer.deyecloud.com:443/)
    DEYE_API_BASE_URL: str = "https://india-developer.deyecloud.com:443"
    DEYE_APP_ID: Optional[str] = None
    DEYE_APP_SECRET: Optional[str] = None
    DEYE_EMAIL: Optional[str] = None
    DEYE_PASSWORD: Optional[str] = None

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, str) and v.startswith("["):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                pass
        return v if isinstance(v, list) else []

    def get_safe_config(self) -> Dict[str, Any]:
        """Return configuration dictionary with masked secrets for safe logging and inspection."""
        return {
            "PROJECT_NAME": self.PROJECT_NAME,
            "VERSION": self.VERSION,
            "ENVIRONMENT": self.ENVIRONMENT,
            "LOG_LEVEL": self.LOG_LEVEL,
            "ALLOWED_ORIGINS": self.ALLOWED_ORIGINS,
            "DOCS_ENABLED": self.DOCS_ENABLED,
            "DATABASE_URL": self.DATABASE_URL.split("@")[-1] if "@" in self.DATABASE_URL else self.DATABASE_URL,
            "DEYE_CONFIGURED": bool(self.DEYE_APP_ID and self.DEYE_APP_SECRET),
            "AUTH_SESSION_COOKIE": self.SESSION_COOKIE_NAME,
            "AUTH_COOKIE_SECURE": self.SESSION_COOKIE_SECURE or (self.ENVIRONMENT == "production"),
            "AUTH_LOCKOUT_POLICY": f"{self.MAX_FAILED_LOGIN_ATTEMPTS} attempts / {self.ACCOUNT_LOCKOUT_MINUTES} min lockout",
            "INITIAL_ADMIN_CONFIGURED": bool(self.INITIAL_ADMIN_EMAIL),
        }

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
