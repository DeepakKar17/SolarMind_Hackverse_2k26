"""SolarMind Authentication API Routes.

Implements production-conscious registration, login, logout, current user lookup,
password recovery, and email verification endpoints.
"""

from typing import Optional
from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import extract_token, get_current_active_user, get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    AuthMessageResponse,
    AuthTokenResponse,
    EmailVerificationRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    ResendVerificationRequest,
    UserLoginRequest,
    UserRegisterRequest,
)
from app.schemas.user import UserResponse
from app.services.auth_service import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication & Access"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register New User Account",
)
def register(
    user_in: UserRegisterRequest,
    db: Session = Depends(get_db),
) -> UserResponse:
    """Register a new user account with validated credentials and Argon2id password hash."""
    user = auth_service.register_user(db=db, user_in=user_in)
    return UserResponse.model_validate(user)


@router.post(
    "/login",
    response_model=AuthTokenResponse,
    summary="Authenticate User & Establish Session",
)
def login(
    login_in: UserLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthTokenResponse:
    """Authenticate user credentials, return Bearer token, and set HttpOnly session cookie."""
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    user, raw_token, expires_in_seconds = auth_service.authenticate_user(
        db=db,
        login_in=login_in,
        ip_address=client_ip,
        user_agent=user_agent,
    )

    # Set secure HttpOnly cookie for browser clients
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=raw_token,
        max_age=expires_in_seconds,
        expires=expires_in_seconds,
        httponly=settings.SESSION_COOKIE_HTTPONLY,
        secure=settings.SESSION_COOKIE_SECURE or (settings.ENVIRONMENT == "production"),
        samesite=settings.SESSION_COOKIE_SAMESITE,
        path="/",
    )

    return AuthTokenResponse(
        access_token=raw_token,
        token_type="bearer",
        expires_in_seconds=expires_in_seconds,
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/logout",
    response_model=AuthMessageResponse,
    summary="Revoke Active Session & Clear Cookie",
)
def logout(
    response: Response,
    token: Optional[str] = Depends(extract_token),
    db: Session = Depends(get_db),
) -> AuthMessageResponse:
    """Revoke the current session in database and delete the HttpOnly session cookie."""
    if token:
        auth_service.logout_session(db, token)

    # Clear cookie regardless
    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        path="/",
    )

    return AuthMessageResponse(
        success=True,
        message="You have been signed out successfully.",
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get Current Authenticated User Profile",
)
def get_current_user_profile(
    current_user: User = Depends(get_current_active_user),
) -> UserResponse:
    """Return the profile of the currently authenticated user."""
    return UserResponse.model_validate(current_user)


@router.post(
    "/forgot-password",
    response_model=AuthMessageResponse,
    summary="Request Password Reset Link (Anti-Enumeration)",
)
def forgot_password(
    req: PasswordResetRequest,
    db: Session = Depends(get_db),
) -> AuthMessageResponse:
    """Generate password reset token without revealing whether the email exists."""
    auth_service.request_password_reset(db, req.email)
    return AuthMessageResponse(
        success=True,
        message="If an account is associated with this email address, password reset instructions have been dispatched.",
    )


@router.post(
    "/reset-password",
    response_model=AuthMessageResponse,
    summary="Confirm Password Reset with Token",
)
def reset_password(
    reset_in: PasswordResetConfirm,
    db: Session = Depends(get_db),
) -> AuthMessageResponse:
    """Validate one-time reset token and update password with Argon2id hash."""
    auth_service.confirm_password_reset(db, reset_in)
    return AuthMessageResponse(
        success=True,
        message="Your password has been successfully reset. You may now sign in with your new credentials.",
    )


@router.post(
    "/verify-email",
    response_model=AuthMessageResponse,
    summary="Verify User Email with Token",
)
def verify_email(
    req: EmailVerificationRequest,
    db: Session = Depends(get_db),
) -> AuthMessageResponse:
    """Validate one-time email verification token."""
    auth_service.verify_email(db, req.token)
    return AuthMessageResponse(
        success=True,
        message="Your email address has been successfully verified.",
    )


@router.post(
    "/resend-verification",
    response_model=AuthMessageResponse,
    summary="Resend Email Verification Link (Anti-Enumeration)",
)
def resend_verification(
    req: ResendVerificationRequest,
    db: Session = Depends(get_db),
) -> AuthMessageResponse:
    """Resend email verification token without revealing account existence."""
    auth_service.resend_verification(db, req.email)
    return AuthMessageResponse(
        success=True,
        message="If an unverified account is associated with this email address, a new verification link has been dispatched.",
    )
