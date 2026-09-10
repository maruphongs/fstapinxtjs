from collections.abc import Generator
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker, Session

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


def init_db() -> None:
    from app.models.base import Base
    import app.models  # Ensure all models are registered with Base.metadata
    Base.metadata.create_all(bind=engine)
