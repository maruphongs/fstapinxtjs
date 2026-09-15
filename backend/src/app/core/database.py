from collections.abc import Generator
from typing import cast

from sqlalchemy import Table, create_engine, event, inspect, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

# SQLite connection arguments
connect_args = {"check_same_thread": False}
engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    connect_args=connect_args,
    echo=False,
)

# Enable foreign keys support in SQLite
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def seed_default_users(db: Session) -> None:
    from app.auth.security import get_password_hash
    from app.models.user import User

    # Seed Admin user if not exists, or update legacy hash
    admin = db.scalar(select(User).where(User.username == "admin"))
    if not admin:
        admin_user = User(
            username="admin",
            hashed_password=get_password_hash("1234"),
            role="admin",
            is_active=True,
        )
        db.add(admin_user)
    elif not admin.hashed_password.startswith("$argon2"):
        admin.hashed_password = get_password_hash("1234")

    # Seed Viewer/Regular user if not exists, or update legacy hash
    regular_user = db.scalar(select(User).where(User.username == "user"))
    if not regular_user:
        viewer_user = User(
            username="user",
            hashed_password=get_password_hash("1234"),
            role="user",
            is_active=True,
        )
        db.add(viewer_user)
    elif not regular_user.hashed_password.startswith("$argon2"):
        regular_user.hashed_password = get_password_hash("1234")

    db.commit()


def init_db() -> None:
    import app.models  # noqa: F401  # Ensure all models are registered with Base.metadata
    from app.models.base import Base
    from app.models.user import User

    # Check if existing users table schema is outdated (e.g. created with old email column)
    inspector = inspect(engine)
    if inspector.has_table("users"):
        existing_cols = {col["name"] for col in inspector.get_columns("users")}
        if "username" not in existing_cols or "role" not in existing_cols:
            cast(Table, User.__table__).drop(bind=engine)

    Base.metadata.create_all(bind=engine)

    # Seed default users
    with SessionLocal() as db:
        seed_default_users(db)
