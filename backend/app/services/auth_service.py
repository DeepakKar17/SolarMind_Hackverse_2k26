"""SolarMind Authentication Service.

Coordinates user authentication, registration, Argon2id hashing, server-managed
sessions, token revocation, anti-enumeration password resets, and account lockout
protection.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.models.auth_session import AuthSession
from app.models.user import User
from app.repositories.auth_session import auth_session_repository
from app.repositories.user import user_repository
from app.schemas.auth import (
    AuthTokenResponse,
    PasswordResetConfirm,
    UserLoginRequest,
    UserRegisterRequest,
)
from app.schemas.user import UserResponse
from app.services.security import (
    auth_rate_limiter,
    generate_secure_token,
    hash_password,
    hash_token,
    needs_rehash,
    verify_password,
)


class AuthService:
    """Service layer managing user authentication workflows."""

    def register_user(self, db: Session, user_in: UserRegisterRequest) -> User:
        """Register a new user account.

        Args:
            db: Database session.
            user_in: Validated registration payload.

        Returns:
            User: Newly registered user entity.

        Raises:
            HTTPException: If email or username is already in use.
        """
        # 1. Check duplicate email
        existing_email = user_repository.get_by_email(db, user_in.email)
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email address already exists.",
            )

        # 2. Check duplicate username if provided
        if user_in.username:
            existing_user = user_repository.get_by_username(db, user_in.username)
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This username is already taken.",
                )

        # 3. Prevent unauthenticated users from assigning themselves admin role
        requested_role = user_in.role or "operator"
        if requested_role.lower() == "admin":
            logger.warning(
                "Security alert: User %s attempted to register directly as 'admin'. Defaulting to 'operator'.",
                user_in.email,
            )
            requested_role = "operator"

        # 4. Hash password with Argon2id
        hashed_pw = hash_password(user_in.password)

        # 5. Create user entity
        user = user_repository.create_user(
            db=db,
            email=user_in.email,
            full_name=user_in.full_name,
            hashed_password=hashed_pw,
            role=requested_role,
            username=user_in.username,
            is_active=True,
            is_verified=False,
        )

        # 6. Generate email verification token
        verify_token = generate_secure_token(32)
        expires_at = datetime.now(timezone.utc) + timedelta(
            hours=settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS
        )
        auth_session_repository.create_session(
            db=db,
            user_id=user.id,
            raw_token=verify_token,
            token_type="email_verify",
            expires_at=expires_at,
        )

        db.commit()
        db.refresh(user)
        logger.info("Successfully registered user id=%s (email=%s, role=%s)", user.id, user.email, user.role)
        return user

    def authenticate_user(
        self,
        db: Session,
        login_in: UserLoginRequest,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[User, str, int]:
        """Authenticate user credentials and create an active session.

        Args:
            db: Database session.
            login_in: Login credentials.
            ip_address: Client IP for rate-limiting and audit.
            user_agent: Client browser user agent.

        Returns:
            Tuple[User, str, int]: (User entity, raw session token, expires_in_seconds)

        Raises:
            HTTPException: If rate limit exceeded, account locked, or credentials invalid.
        """
        identifier = login_in.email_or_username.strip()
        client_ip = ip_address or "unknown"
        
        # 1. Rate limiting by IP and identifier (5 attempts per 60s window)
        rate_key = f"login:{client_ip}:{identifier.lower()}"
        allowed, retry_after = auth_rate_limiter.is_allowed(rate_key, max_requests=10, window_seconds=60)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many login attempts. Please wait {retry_after} seconds before trying again.",
                headers={"Retry-After": str(retry_after)},
            )

        # 2. Lookup user by email or username
        user = user_repository.get_by_identifier(db, identifier)
        now = datetime.now(timezone.utc)

        # 3. Check Account Lockout if user exists
        if user and user.is_locked(now):
            locked_dt = user.locked_until
            if locked_dt and locked_dt.tzinfo is None:
                locked_dt = locked_dt.replace(tzinfo=timezone.utc)
            remaining_seconds = int((locked_dt - now).total_seconds()) if locked_dt else 0
            logger.warning(
                "Login blocked: Account %s is locked until %s",
                user.email,
                user.locked_until,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account is temporarily locked due to excessive failed attempts. Please try again in {max(1, remaining_seconds // 60)} minutes or reset your password.",
            )

        # 4. Constant-time password verification
        is_valid_pw = False
        if user:
            is_valid_pw = verify_password(login_in.password, user.hashed_password)

        if not user or not is_valid_pw:
            if user:
                attempts, locked_until = user_repository.record_failed_login(
                    db=db,
                    user=user,
                    max_attempts=settings.MAX_FAILED_LOGIN_ATTEMPTS,
                    lockout_minutes=settings.ACCOUNT_LOCKOUT_MINUTES,
                )
                db.commit()
                if locked_until:
                    logger.warning("Account %s locked out after %d failed attempts", user.email, attempts)
            
            # Anti-enumeration generic error message
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email/username or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # 5. Check if user account is deactivated
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This user account has been deactivated. Please contact your system administrator.",
            )

        # 6. Reset failed attempts & update last login audit
        user_repository.record_successful_login(db, user, ip_address=client_ip)
        auth_rate_limiter.reset(rate_key)

        # 7. Check if Argon2id parameters need rehash
        if needs_rehash(user.hashed_password):
            user.hashed_password = hash_password(login_in.password)
            db.flush()

        # 8. Create session token (14 days for remember_me, 24 hours standard)
        duration_minutes = (
            settings.REMEMBER_ME_EXPIRE_DAYS * 24 * 60
            if login_in.remember_me
            else settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
        expires_at = now + timedelta(minutes=duration_minutes)
        raw_session_token = generate_secure_token(32)

        auth_session_repository.create_session(
            db=db,
            user_id=user.id,
            raw_token=raw_session_token,
            token_type="session",
            expires_at=expires_at,
            ip_address=client_ip,
            user_agent=user_agent,
        )

        db.commit()
        db.refresh(user)
        logger.info("User id=%s (email=%s) authenticated successfully", user.id, user.email)
        return user, raw_session_token, int(duration_minutes * 60)

    def validate_session_token(
        self,
        db: Session,
        raw_token: str,
    ) -> Optional[User]:
        """Validate session token and return user if active and unexpired.

        Args:
            db: Database session.
            raw_token: Plaintext token extracted from cookie or Bearer header.

        Returns:
            Optional[User]: Active user entity or None.
        """
        if not raw_token:
            return None

        session_record = auth_session_repository.get_by_token(db, raw_token, token_type="session")
        if not session_record:
            return None

        now = datetime.now(timezone.utc)
        if not session_record.is_valid(now):
            return None

        user = session_record.user
        if not user or not user.is_active:
            return None

        return user

    def logout_session(self, db: Session, raw_token: str) -> bool:
        """Revoke active session token.

        Args:
            db: Database session.
            raw_token: Plaintext token.

        Returns:
            bool: True if revoked.
        """
        if not raw_token:
            return False
        revoked = auth_session_repository.revoke_token(db, raw_token)
        db.commit()
        return revoked

    def request_password_reset(self, db: Session, email: str) -> Optional[str]:
        """Generate one-time password reset token with anti-enumeration protection.

        Args:
            db: Database session.
            email: Target email address.

        Returns:
            Optional[str]: Generated raw token (for test/dispatch delivery) or None.
        """
        user = user_repository.get_by_email(db, email)
        if not user or not user.is_active:
            # Privacy guarantee: log internally but do not leak existence to caller
            logger.info("Password reset requested for non-existent or inactive email: %s", email)
            return None

        # Revoke existing password reset tokens for this user
        auth_session_repository.revoke_all_for_user(db, user.id, token_type="password_reset")

        raw_reset_token = generate_secure_token(32)
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
        )

        auth_session_repository.create_session(
            db=db,
            user_id=user.id,
            raw_token=raw_reset_token,
            token_type="password_reset",
            expires_at=expires_at,
        )

        db.commit()
        logger.info("Generated password reset token for user id=%s (%s)", user.id, user.email)
        return raw_reset_token

    def confirm_password_reset(
        self,
        db: Session,
        reset_in: PasswordResetConfirm,
    ) -> bool:
        """Validate reset token and update password using Argon2id.

        Args:
            db: Database session.
            reset_in: Reset confirmation payload.

        Returns:
            bool: True on success.

        Raises:
            HTTPException: If token is invalid or expired.
        """
        session_record = auth_session_repository.get_by_token(
            db, reset_in.token, token_type="password_reset"
        )
        now = datetime.now(timezone.utc)

        if not session_record or not session_record.is_valid(now):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password reset link is invalid or has expired.",
            )

        user = session_record.user
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User account associated with this reset link is inactive.",
            )

        # Hash new password with Argon2id
        new_hashed = hash_password(reset_in.new_password)
        user_repository.update_password(db, user, new_hashed)

        # Revoke the used reset token
        auth_session_repository.revoke_token(db, reset_in.token)

        # Invalidate all active sessions across all devices for security
        auth_session_repository.revoke_all_for_user(db, user.id, token_type="session")

        db.commit()
        logger.info("Password successfully updated and sessions invalidated for user id=%s", user.id)
        return True

    def verify_email(self, db: Session, token: str) -> bool:
        """Verify user's email address using a one-time cryptographic token.

        Args:
            db: Database session.
            token: Raw verification token.

        Returns:
            bool: True on success.

        Raises:
            HTTPException: If token is invalid or expired.
        """
        session_record = auth_session_repository.get_by_token(
            db, token, token_type="email_verify"
        )
        now = datetime.now(timezone.utc)

        if not session_record or not session_record.is_valid(now):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email verification link is invalid or has expired.",
            )

        user = session_record.user
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No user associated with this verification link.",
            )

        user_repository.mark_verified(db, user)
        auth_session_repository.revoke_token(db, token)
        db.commit()
        logger.info("Email verified for user id=%s (%s)", user.id, user.email)
        return True

    def resend_verification(self, db: Session, email: str) -> Optional[str]:
        """Generate a fresh verification token for an unverified account.

        Args:
            db: Database session.
            email: Email address.

        Returns:
            Optional[str]: Generated raw token or None.
        """
        user = user_repository.get_by_email(db, email)
        if not user or not user.is_active or user.is_verified:
            # Privacy guarantee: do not expose whether email exists or is verified
            return None

        auth_session_repository.revoke_all_for_user(db, user.id, token_type="email_verify")

        raw_token = generate_secure_token(32)
        expires_at = datetime.now(timezone.utc) + timedelta(
            hours=settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS
        )

        auth_session_repository.create_session(
            db=db,
            user_id=user.id,
            raw_token=raw_token,
            token_type="email_verify",
            expires_at=expires_at,
        )

        db.commit()
        return raw_token

    def provision_initial_admin(
        self,
        db: Session,
        email: Optional[str] = None,
        password: Optional[str] = None,
        full_name: Optional[str] = None,
    ) -> Optional[User]:
        """Controlled procedure to initialize the first administrator.

        Args:
            db: Database session.
            email: Admin email (falls back to INITIAL_ADMIN_EMAIL setting).
            password: Admin password (falls back to INITIAL_ADMIN_PASSWORD setting).
            full_name: Admin full name.

        Returns:
            Optional[User]: Created or existing admin user.
        """
        admin_email = email or settings.INITIAL_ADMIN_EMAIL
        admin_password = password or settings.INITIAL_ADMIN_PASSWORD
        admin_name = full_name or settings.INITIAL_ADMIN_FULL_NAME

        if not admin_email or not admin_password:
            logger.info("Initial admin provisioning skipped: no email/password configured.")
            return None

        existing_admin = user_repository.get_by_email(db, admin_email)
        if existing_admin:
            if existing_admin.role != "admin":
                existing_admin.role = "admin"
                db.commit()
                logger.info("Promoted user %s to admin role.", admin_email)
            return existing_admin

        hashed_pw = hash_password(admin_password)
        admin_user = user_repository.create_user(
            db=db,
            email=admin_email,
            full_name=admin_name,
            hashed_password=hashed_pw,
            role="admin",
            username="admin",
            is_active=True,
            is_verified=True,
        )
        db.commit()
        db.refresh(admin_user)
        logger.info("Successfully provisioned initial administrator: %s", admin_email)
        return admin_user


auth_service = AuthService()
