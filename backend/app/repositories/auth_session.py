"""Authentication Session Database Repository.

Manages persistent server sessions, refresh tokens, one-time verification tokens,
and cryptographic token revocation.
"""

from datetime import datetime, timezone
from typing import Any, List, Optional
from pydantic import BaseModel
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.models.auth_session import AuthSession
from app.repositories.base import BaseRepository
from app.services.security import hash_token


class AuthSessionRepository(BaseRepository[AuthSession, Any, Any]):
    """Repository managing hashed token lookup and lifecycle."""

    def __init__(self):
        super().__init__(AuthSession)

    def create_session(
        self,
        db: Session,
        user_id: int,
        raw_token: str,
        token_type: str,
        expires_at: datetime,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AuthSession:
        """Store SHA-256 hash of generated token."""
        token_hash = hash_token(raw_token)
        session = AuthSession(
            user_id=user_id,
            token_hash=token_hash,
            token_type=token_type,
            expires_at=expires_at,
            is_revoked=False,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(session)
        db.flush()
        return session

    def get_by_token(
        self,
        db: Session,
        raw_token: str,
        token_type: Optional[str] = None,
    ) -> Optional[AuthSession]:
        """Lookup session by raw token value (via SHA-256 hash matching)."""
        if not raw_token:
            return None
        token_hash = hash_token(raw_token)
        stmt = select(AuthSession).where(AuthSession.token_hash == token_hash)
        if token_type:
            stmt = stmt.where(AuthSession.token_type == token_type)
        return db.execute(stmt).scalar_one_or_none()

    def revoke_token(self, db: Session, raw_token: str) -> bool:
        """Mark a specific session or token as revoked."""
        if not raw_token:
            return False
        token_hash = hash_token(raw_token)
        result = db.execute(
            update(AuthSession)
            .where(AuthSession.token_hash == token_hash)
            .values(is_revoked=True)
        )
        db.flush()
        return result.rowcount > 0

    def revoke_all_for_user(
        self,
        db: Session,
        user_id: int,
        token_type: Optional[str] = None,
    ) -> int:
        """Revoke all sessions/tokens belonging to a user."""
        stmt = update(AuthSession).where(AuthSession.user_id == user_id)
        if token_type:
            stmt = stmt.where(AuthSession.token_type == token_type)
        result = db.execute(stmt.values(is_revoked=True))
        db.flush()
        return result.rowcount

    def get_active_sessions_for_user(self, db: Session, user_id: int) -> List[AuthSession]:
        """Get all unrevoked, unexpired sessions for a user."""
        now = datetime.now(timezone.utc)
        return list(
            db.execute(
                select(AuthSession)
                .where(
                    AuthSession.user_id == user_id,
                    AuthSession.is_revoked.is_(False),
                    AuthSession.expires_at > now,
                )
                .order_by(AuthSession.created_at.desc())
            ).scalars().all()
        )

    def purge_expired(self, db: Session) -> int:
        """Delete expired sessions to maintain clean database state."""
        now = datetime.now(timezone.utc)
        result = db.execute(
            delete(AuthSession).where(
                (AuthSession.expires_at < now) | (AuthSession.is_revoked.is_(True))
            )
        )
        db.flush()
        return result.rowcount


auth_session_repository = AuthSessionRepository()
