"""Authentication Session & Token Database Model for SolarMind.

Tracks server-managed browser sessions, refresh tokens, password reset tokens,
and email verification tokens. Stores SHA-256 token hashes rather than plaintext
credentials to ensure secure token lifecycle management and instant revocation.
"""

from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, utc_now


class AuthSession(Base):
    """Stores active sessions, access tokens, and one-time verification tokens."""

    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    # SHA-256 hash of the cryptographically random token
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    
    # Token classification: 'session' | 'access' | 'refresh' | 'password_reset' | 'email_verify'
    token_type: Mapped[str] = mapped_column(String(30), default="session", index=True, nullable=False)
    
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, index=True, nullable=False)
    
    # Audit telemetry
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="sessions")

    def is_expired(self, now: datetime) -> bool:
        """Check if session/token has expired."""
        if self.expires_at.tzinfo is None:
            # Handle naive datetime from SQLite
            return self.expires_at < now.replace(tzinfo=None)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)
        return self.expires_at < now

    def is_valid(self, now: datetime) -> bool:
        """Check if session/token is valid, not revoked, and unexpired."""
        return not self.is_revoked and not self.is_expired(now)
