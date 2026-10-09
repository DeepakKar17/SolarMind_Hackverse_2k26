"""Audit Service for Recording Security, Administrative, and Lifecycle Events.

Ensures that mutations and their corresponding audit logs commit atomically within
transactions, handling rollback safely when either operation fails.
"""

from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Callable, Generator, Optional, TypeVar
from sqlalchemy.orm import Session

from app.models.audit_event import AuditEvent
from app.models.user import User

T = TypeVar("T")


def log_audit_event(
    db: Session,
    actor: Optional[User],
    action: str,
    target_type: str,
    target_id: Optional[str] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None,
    status: str = "SUCCESS",
) -> AuditEvent:
    """Record an immutable audit event in the current database transaction."""
    event = AuditEvent(
        timestamp=datetime.now(timezone.utc),
        actor_id=actor.id if actor else None,
        actor_email=actor.email if actor else "SYSTEM",
        role=actor.role if actor else "system",
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        details=details,
        ip_address=ip_address,
        status=status,
    )
    db.add(event)
    return event


@contextmanager
def transactional_audit(
    db: Session,
    actor: Optional[User],
    action: str,
    target_type: str,
    target_id: Optional[str] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> Generator[None, None, None]:
    """Execute a block within a database transaction with automated audit event logging.

    If the enclosed block raises an exception, the transaction is rolled back safely.
    If it succeeds, both the mutation and audit record commit atomically.
    """
    try:
        yield
        log_audit_event(
            db=db,
            actor=actor,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details,
            ip_address=ip_address,
            status="SUCCESS",
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
