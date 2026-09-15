from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import get_password_hash, verify_password
from app.models.user import User
from app.schemas.auth import UserRegister


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def get_user_by_username(db: Session, username: str) -> User | None:
    stmt = select(User).where(User.username == username)
    return db.scalar(stmt)


def create_user(db: Session, user_in: UserRegister, role: str = "user") -> User:
    db_user = User(
        username=user_in.username,
        hashed_password=get_password_hash(user_in.password),
        role=role,
        is_active=True,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_users(db: Session, skip: int = 0, limit: int = 100) -> list[User]:
    stmt = select(User).order_by(User.id.asc()).offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    user = get_user_by_username(db, username)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def update_user(
    db: Session,
    user: User,
    role: str | None = None,
    is_active: bool | None = None,
    password: str | None = None,
) -> User:
    if role is not None:
        user.role = role
    if is_active is not None:
        user.is_active = is_active
    if password is not None:
        user.hashed_password = get_password_hash(password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user: User) -> None:
    db.delete(user)
    db.commit()
