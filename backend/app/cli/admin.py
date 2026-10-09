"""SolarMind Administrator Provisioning CLI.

Provides a secure, controlled command-line tool for provisioning the initial
administrator without exposing any public web endpoint for unauthorized admin
creation.
"""

import argparse
import sys
from app.db.session import get_db_context
from app.services.auth_service import auth_service
from app.services.security import hash_password
from app.repositories.user import user_repository


from typing import Optional
from sqlalchemy.orm import Session


def create_admin(
    email: str,
    password: str,
    full_name: str,
    username: str = "admin",
    db: Optional[Session] = None,
) -> None:
    """Provision a new system administrator."""
    if len(password) < 8:
        print("Error: Password must be at least 8 characters long.", file=sys.stderr)
        sys.exit(1)

    def _execute(session: Session):
        existing = user_repository.get_by_email(session, email)
        if existing:
            existing.role = "admin"
            existing.hashed_password = hash_password(password)
            existing.is_active = True
            existing.is_verified = True
            session.commit()
            print(f"Existing user '{email}' was successfully updated and promoted to Administrator.")
            return

        admin = user_repository.create_user(
            db=session,
            email=email,
            full_name=full_name,
            hashed_password=hash_password(password),
            role="admin",
            username=username,
            is_active=True,
            is_verified=True,
        )
        session.commit()
        print(f"Administrator successfully provisioned (ID: {admin.id}, Email: {admin.email}).")

    if db is not None:
        _execute(db)
    else:
        with get_db_context() as session:
            _execute(session)


def main():
    parser = argparse.ArgumentParser(description="SolarMind Admin CLI Utility")
    subparsers = parser.add_subparsers(dest="command", required=True)

    create_parser = subparsers.add_parser("create-admin", help="Create or promote an administrator")
    create_parser.add_argument("--email", required=True, help="Administrator email address")
    create_parser.add_argument("--password", required=True, help="Secure password (min 8 chars)")
    create_parser.add_argument("--name", default="System Administrator", help="Full name")
    create_parser.add_argument("--username", default="admin", help="System username")

    args = parser.parse_args()
    if args.command == "create-admin":
        create_admin(email=args.email, password=args.password, full_name=args.name, username=args.username)


if __name__ == "__main__":
    main()
