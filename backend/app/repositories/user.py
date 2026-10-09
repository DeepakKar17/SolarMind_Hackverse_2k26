"""User Database Repository.

CRUD operations, lookup by email/username, failed-login tracking, and account
lockout management.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional, Tuple
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.base import BaseRepository
from app.schemas.auth import UserRegisterRequest
from app.schemas.user import UserUpdate


class UserRepository(BaseRepository[User, UserRegisterRequest, UserUpdate]):
    """Repository handling User entity persistence and security state."""

    def __init__(self):
        super().__init__(User)

    def get_by_email(self, db: Session, email: str) -> Optional[User]:
        """Lookup user by unique case-insensitive email address."""
        if not email:
            return None
        return db.execute(
            select(User).where(User.email.ilike(email.strip()))
        ).scalar_one_or_none()

    def get_by_username(self, db: Session, username: str) -> Optional[User]:
        """Lookup user by unique username."""
        if not username:
            return None
        return db.execute(
            select(User).where(User.username == username.strip())
        ).scalar_one_or_none()

    def get_by_identifier(self, db: Session, identifier: str) -> Optional[User]:
        """Lookup user by either email or username."""
        if not identifier:
            return None
        cleaned = identifier.strip()
        return db.execute(
            select(User).where(
                or_(
                    User.email.ilike(cleaned),
                    User.username == cleaned,
                )
            )
        ).scalar_one_or_none()

    def create_user(
        self,
        db: Session,
        email: str,
        full_name: str,
        hashed_password: str,
        role: str = "operator",
        username: Optional[str] = None,
        is_active: bool = True,
        is_verified: bool = False,
    ) -> User:
        """Create a new user with Argon2id password hash."""
        user = User(
            email=email.strip().lower(),
            full_name=full_name.strip(),
            hashed_password=hashed_password,
            role=role,
            username=username.strip() if username else None,
            is_active=is_active,
            is_verified=is_verified,
            failed_login_attempts=0,
        )
        db.add(user)
        db.flush()
        return user

    def record_failed_login(
        self,
        db: Session,
        user: User,
        max_attempts: int = 5,
        lockout_minutes: int = 15,
    ) -> Tuple[int, Optional[datetime]]:
        """Increment failed login counter and apply lockout if threshold exceeded."""
        now = datetime.now(timezone.utc)
        user.failed_login_attempts += 1
        
        if user.failed_login_attempts >= max_attempts:
            user.locked_until = now + timedelta(minutes=lockout_minutes)
        
        db.flush()
        return user.failed_login_attempts, user.locked_until

    def record_successful_login(
        self,
        db: Session,
        user: User,
        ip_address: Optional[str] = None,
    ) -> None:
        """Reset failed attempt counters and record login audit timestamp."""
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login_at = datetime.now(timezone.utc)
        if ip_address:
            user.last_login_ip = ip_address
        db.flush()

    def update_password(self, db: Session, user: User, new_hashed_password: str) -> None:
        """Update password hash, reset failed counters, and unlock account."""
        user.hashed_password = new_hashed_password
        user.failed_login_attempts = 0
        user.locked_until = None
        db.flush()

    def mark_verified(self, db: Session, user: User) -> None:
        """Mark user's email address as verified."""
        user.is_verified = True
        db.flush()


user_repository = UserRepository()
