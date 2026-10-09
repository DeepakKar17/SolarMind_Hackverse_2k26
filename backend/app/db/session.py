"""
Database Engine & Session Management Module
Configures SQLAlchemy 2.x engine, SQLite PRAGMA options, session factories, and request dependencies.
"""

import os
from contextlib import contextmanager
from typing import Generator
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings
from app.core.logging import logger


def get_engine_options(database_url: str) -> dict:
    """Returns engine configuration dictionary based on target database dialect."""
    if database_url.startswith("sqlite"):
        # Auto-create data directory if relative or absolute path specified
        if "///" in database_url:
            db_path = database_url.split("///", 1)[1]
            if db_path and not db_path.startswith(":memory:"):
                dir_path = os.path.dirname(os.path.abspath(db_path))
                if dir_path and not os.path.exists(dir_path):
                    os.makedirs(dir_path, exist_ok=True)
                    logger.info(f"Created SQLite database directory: {dir_path}")

        return {
            "connect_args": {
                "check_same_thread": False,
                "timeout": 15,
            },
            "pool_pre_ping": True,
        }

    # Production PostgreSQL connection pool options
    return {
        "pool_size": getattr(settings, "DB_POOL_SIZE", 10),
        "max_overflow": getattr(settings, "DB_MAX_OVERFLOW", 20),
        "pool_timeout": getattr(settings, "DB_POOL_TIMEOUT", 30),
        "pool_recycle": getattr(settings, "DB_POOL_RECYCLE", 1800),
        "pool_pre_ping": True,
    }


# Create SQLAlchemy 2.x Engine
engine: Engine = create_engine(
    settings.DATABASE_URL,
    **get_engine_options(settings.DATABASE_URL),
)


# SQLite PRAGMA configuration listener for foreign keys, WAL mode & concurrency
@event.listens_for(Engine, "connect")
def configure_sqlite_connection(dbapi_connection, connection_record):
    """Enforces SQLite Foreign Keys, WAL journal mode, and busy timeout."""
    if settings.DATABASE_URL.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys = ON;")
        cursor.execute("PRAGMA journal_mode = WAL;")
        cursor.execute("PRAGMA busy_timeout = 5000;")
        cursor.close()


# Session Factory
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI request-scoped dependency for yielding database sessions.
    Guarantees session closure on request completion or error.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context() -> Generator[Session, None, None]:
    """
    Context manager for background workers, CLI scripts, and initialization routines.
    Ensures safe commit/rollback and session lifecycle management.
    """
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
