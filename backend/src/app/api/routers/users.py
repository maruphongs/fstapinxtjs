from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user, get_current_admin_user
from app.core.database import get_db
from app.crud import user as crud_user
from app.models.user import User
from app.schemas.auth import UserCreate, UserResponse, UserUpdate

router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


@router.get("", response_model=list[UserResponse])
@router.get("/", response_model=list[UserResponse], include_in_schema=False)
def get_users(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """List all registered users (accessible by authenticated active users)."""
    return crud_user.get_users(db, skip=skip, limit=limit)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_user(
    user_in: UserCreate,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin_user)],
):
    """Create a new user with specified role (Admin only)."""
    existing = crud_user.get_user_by_username(db, user_in.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already registered",
        )
    return crud_user.create_user(db, user_in, role=user_in.role)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get single user by ID."""
    user = crud_user.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin_user)],
):
    """Update user role, active status, or password (Admin only)."""
    target_user = crud_user.get_user_by_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Prevent admin from deactivating themselves
    if current_admin.id == target_user.id and user_in.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )

    # Prevent admin from removing their own admin role
    if current_admin.id == target_user.id and user_in.role and user_in.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot demote your own account from admin",
        )

    return crud_user.update_user(
        db,
        target_user,
        role=user_in.role,
        is_active=user_in.is_active,
        password=user_in.password,
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin_user)],
):
    """Delete a user account (Admin only)."""
    target_user = crud_user.get_user_by_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if current_admin.id == target_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    crud_user.delete_user(db, target_user)
    return { "message": "User deleted successfully" }
