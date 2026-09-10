"""
Compatibility module re-exporting core database components.
"""
from app.core.database import SessionLocal, engine, get_db
from app.models.base import Base

__all__ = ["Base", "engine", "SessionLocal", "get_db"]
