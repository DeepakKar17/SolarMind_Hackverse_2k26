"""SolarMind Authentication & Security Test Suite.

Validates Argon2id hashing, registration, login, server-managed cookies, Bearer
tokens, account lockouts, session revocation, anti-enumeration, and role guards.
"""

from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.models.auth_session import AuthSession
from app.models.user import User
from app.repositories.auth_session import auth_session_repository
from app.repositories.user import user_repository
from app.services.auth_service import auth_service
from app.services.security import (
    hash_password,
    hash_token,
    verify_password,
)
from app.cli.admin import create_admin


def test_argon2id_password_hashing():
    """Verify that password hashing uses Argon2id and verifies correctly."""
    plain = "SolarEngineer#2026!"
    hashed = hash_password(plain)

    # Argon2id hash format check
    assert hashed.startswith("$argon2id$")
    assert plain not in hashed
    assert verify_password(plain, hashed) is True
    assert verify_password("WrongPassword123", hashed) is False
    assert verify_password("", hashed) is False
    assert verify_password(plain, "") is False


def test_user_registration_success(client: TestClient, db_session: Session):
    """Test standard user registration flow."""
    payload = {
        "full_name": "Sarah Connor",
        "email": "sarah.connor@solarmind.io",
        "password": "SecurePassword#2026",
        "confirm_password": "SecurePassword#2026",
        "username": "sconnor",
        "role": "operator",
        "accept_terms": True,
    }

    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "sarah.connor@solarmind.io"
    assert data["full_name"] == "Sarah Connor"
    assert data["role"] == "operator"
    assert data["is_active"] is True
    assert data["is_verified"] is False
    assert "password" not in data

    # Verify database state
    user = user_repository.get_by_email(db_session, "sarah.connor@solarmind.io")
    assert user is not None
    assert user.hashed_password.startswith("$argon2id$")
    assert "SecurePassword#2026" not in user.hashed_password


def test_user_registration_duplicate_email(client: TestClient):
    """Test duplicate registration rejection."""
    payload = {
        "full_name": "First User",
        "email": "duplicate@solarmind.io",
        "password": "SecurePassword#2026",
        "confirm_password": "SecurePassword#2026",
        "accept_terms": True,
    }
    res1 = client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"]


def test_user_registration_validation_errors(client: TestClient):
    """Test validation errors for passwords and terms."""
    # Mismatched passwords
    res1 = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Test User",
            "email": "test1@solarmind.io",
            "password": "Password123!",
            "confirm_password": "DifferentPassword123!",
            "accept_terms": True,
        },
    )
    assert res1.status_code == 422

    # Short password
    res2 = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Test User",
            "email": "test2@solarmind.io",
            "password": "short",
            "confirm_password": "short",
            "accept_terms": True,
        },
    )
    assert res2.status_code == 422

    # Terms not accepted
    res3 = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Test User",
            "email": "test3@solarmind.io",
            "password": "ValidPassword123!",
            "confirm_password": "ValidPassword123!",
            "accept_terms": False,
        },
    )
    assert res3.status_code == 422


def test_user_registration_cannot_self_assign_admin(client: TestClient, db_session: Session):
    """Test that public registration silently defaults requested 'admin' to 'operator'."""
    payload = {
        "full_name": "Sneaky Admin",
        "email": "sneaky@solarmind.io",
        "password": "SecurePassword#2026",
        "confirm_password": "SecurePassword#2026",
        "role": "admin",
        "accept_terms": True,
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    assert response.json()["role"] == "operator"


def test_login_success_sets_cookie_and_token(client: TestClient, db_session: Session):
    """Test successful login returning Bearer token and setting HttpOnly cookie."""
    # Create test user
    user = user_repository.create_user(
        db=db_session,
        email="tech@solarmind.io",
        full_name="Tech Lead",
        hashed_password=hash_password("TechLead#2026!"),
        role="asset_manager",
        is_active=True,
    )
    db_session.commit()

    login_res = client.post(
        "/api/v1/auth/login",
        json={"email_or_username": "tech@solarmind.io", "password": "TechLead#2026!", "remember_me": False},
    )
    assert login_res.status_code == 200
    data = login_res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "tech@solarmind.io"
    assert data["user"]["role"] == "asset_manager"

    # Check HttpOnly cookie
    assert "solarmind_session" in login_res.cookies
    cookie_val = login_res.cookies["solarmind_session"]
    assert cookie_val == data["access_token"]


def test_login_invalid_password_and_anti_enumeration(client: TestClient, db_session: Session):
    """Test that invalid password and non-existent user return identical generic 401."""
    user = user_repository.create_user(
        db=db_session,
        email="existing@solarmind.io",
        full_name="Existing User",
        hashed_password=hash_password("RealPassword#2026"),
        is_active=True,
    )
    db_session.commit()

    # Wrong password for existing user
    res1 = client.post(
        "/api/v1/auth/login",
        json={"email_or_username": "existing@solarmind.io", "password": "WrongPassword!"},
    )
    assert res1.status_code == 401
    assert "Invalid email/username or password" in res1.json()["detail"]

    # Non-existent user
    res2 = client.post(
        "/api/v1/auth/login",
        json={"email_or_username": "nonexistent@solarmind.io", "password": "AnyPassword!"},
    )
    assert res2.status_code == 401
    assert "Invalid email/username or password" in res2.json()["detail"]


def test_login_account_lockout_after_max_attempts(client: TestClient, db_session: Session):
    """Test account lockout mechanism after 5 consecutive failed attempts."""
    user = user_repository.create_user(
        db=db_session,
        email="lockme@solarmind.io",
        full_name="Lockout Target",
        hashed_password=hash_password("CorrectPass#2026"),
        is_active=True,
    )
    db_session.commit()

    # Fail 5 times
    for i in range(5):
        res = client.post(
            "/api/v1/auth/login",
            json={"email_or_username": "lockme@solarmind.io", "password": f"BadPassword{i}"},
        )
        assert res.status_code == 401

    # 6th attempt should be blocked by Account Lockout (403 Forbidden)
    res_locked = client.post(
        "/api/v1/auth/login",
        json={"email_or_username": "lockme@solarmind.io", "password": "CorrectPass#2026"},
    )
    assert res_locked.status_code == 403
    assert "temporarily locked" in res_locked.json()["detail"]


def test_login_inactive_user_rejected(client: TestClient, db_session: Session):
    """Test that deactivated accounts cannot log in."""
    user = user_repository.create_user(
        db=db_session,
        email="inactive@solarmind.io",
        full_name="Inactive User",
        hashed_password=hash_password("InactivePass#2026"),
        is_active=False,
    )
    db_session.commit()

    res = client.post(
        "/api/v1/auth/login",
        json={"email_or_username": "inactive@solarmind.io", "password": "InactivePass#2026"},
    )
    assert res.status_code == 403
    assert "deactivated" in res.json()["detail"]


def test_get_current_user_via_bearer_and_cookie(client: TestClient, db_session: Session):
    """Test /auth/me authentication via both Bearer header and session cookie."""
    user = user_repository.create_user(
        db=db_session,
        email="profile@solarmind.io",
        full_name="Profile Checker",
        hashed_password=hash_password("ProfilePass#2026"),
        role="operator",
        is_active=True,
    )
    db_session.commit()

    login_res = client.post(
        "/api/v1/auth/login",
        json={"email_or_username": "profile@solarmind.io", "password": "ProfilePass#2026"},
    )
    token = login_res.json()["access_token"]

    # 1. Access with Bearer token
    bearer_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert bearer_res.status_code == 200
    assert bearer_res.json()["email"] == "profile@solarmind.io"

    # 2. Access with Cookie
    client.cookies.set("solarmind_session", token)
    cookie_res = client.get("/api/v1/auth/me")
    assert cookie_res.status_code == 200
    assert cookie_res.json()["email"] == "profile@solarmind.io"
    client.cookies.clear()


def test_logout_revokes_session(client: TestClient, db_session: Session):
    """Test logout endpoint revokes token in database and invalidates subsequent calls."""
    user = user_repository.create_user(
        db=db_session,
        email="logout@solarmind.io",
        full_name="Logout User",
        hashed_password=hash_password("LogoutPass#2026"),
        is_active=True,
    )
    db_session.commit()

    login_res = client.post(
        "/api/v1/auth/login",
        json={"email_or_username": "logout@solarmind.io", "password": "LogoutPass#2026"},
    )
    token = login_res.json()["access_token"]

    # Verify authenticated
    auth_check = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert auth_check.status_code == 200

    # Logout
    logout_res = client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert logout_res.status_code == 200

    # Attempt to use revoked token
    retry_check = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert retry_check.status_code == 401


def test_password_reset_anti_enumeration_and_confirm(client: TestClient, db_session: Session):
    """Test forgot-password anti-enumeration and reset confirmation flow."""
    user = user_repository.create_user(
        db=db_session,
        email="resetme@solarmind.io",
        full_name="Reset User",
        hashed_password=hash_password("OldPassword#2026"),
        is_active=True,
    )
    db_session.commit()

    # 1. Request reset for existing email
    res1 = client.post("/api/v1/auth/forgot-password", json={"email": "resetme@solarmind.io"})
    assert res1.status_code == 200
    assert "instructions have been dispatched" in res1.json()["message"]

    # 2. Request reset for non-existing email returns identical response
    res2 = client.post("/api/v1/auth/forgot-password", json={"email": "nobody@solarmind.io"})
    assert res2.status_code == 200
    assert "instructions have been dispatched" in res2.json()["message"]

    # Retrieve created reset token directly from service
    raw_token = auth_service.request_password_reset(db_session, "resetme@solarmind.io")
    assert raw_token is not None

    # 3. Confirm password reset
    confirm_res = client.post(
        "/api/v1/auth/reset-password",
        json={
            "token": raw_token,
            "new_password": "NewSecurePassword#2026",
            "confirm_password": "NewSecurePassword#2026",
        },
    )
    assert confirm_res.status_code == 200
    assert "successfully reset" in confirm_res.json()["message"]

    # 4. Old password should fail, new password succeeds
    login_old = client.post(
        "/api/v1/auth/login",
        json={"email_or_username": "resetme@solarmind.io", "password": "OldPassword#2026"},
    )
    assert login_old.status_code == 401

    login_new = client.post(
        "/api/v1/auth/login",
        json={"email_or_username": "resetme@solarmind.io", "password": "NewSecurePassword#2026"},
    )
    assert login_new.status_code == 200


def test_email_verification_lifecycle(client: TestClient, db_session: Session):
    """Test email verification token flow."""
    user = user_repository.create_user(
        db=db_session,
        email="unverified@solarmind.io",
        full_name="Unverified User",
        hashed_password=hash_password("Unverified#2026"),
        is_active=True,
        is_verified=False,
    )
    db_session.commit()
    assert user.is_verified is False

    raw_token = auth_service.resend_verification(db_session, "unverified@solarmind.io")
    assert raw_token is not None

    # Verify with token
    verify_res = client.post("/api/v1/auth/verify-email", json={"token": raw_token})
    assert verify_res.status_code == 200
    assert "successfully verified" in verify_res.json()["message"]

    # Check user is now verified
    db_session.refresh(user)
    assert user.is_verified is True


def test_admin_cli_provisioning(db_session: Session):
    """Test administrator provisioning through controlled CLI function."""
    create_admin(
        email="cli.admin@solarmind.io",
        password="AdminCliPassword#2026!",
        full_name="CLI Administrator",
        username="cli_admin",
        db=db_session,
    )

    admin = user_repository.get_by_email(db_session, "cli.admin@solarmind.io")
    assert admin is not None
    assert admin.role == "admin"
    assert admin.is_active is True
    assert admin.is_verified is True
    assert verify_password("AdminCliPassword#2026!", admin.hashed_password) is True
