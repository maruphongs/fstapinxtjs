from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user, get_current_user
from app.core.database import get_db
from app.crud import product as crud_product
from app.crud import reservation as crud_reservation
from app.models.user import User
from app.schemas.reservation import (
    ProductLockStatus,
    ReservationCreate,
    ReservationResponse,
)

router = APIRouter(
    prefix="/products",
    tags=["Reservations"],
)


def _format_reservation_response(res, current_user_id: int | None) -> ReservationResponse:
    now = datetime.utcnow()
    is_exp = res.expires_at <= now or res.status != "active"
    remaining = max(0, int((res.expires_at - now).total_seconds())) if not is_exp else 0
    return ReservationResponse(
        id=res.id,
        product_id=res.product_id,
        user_id=res.user_id,
        status=res.status,
        expires_at=res.expires_at,
        created_at=res.created_at,
        is_expired=is_exp,
        remaining_seconds=remaining,
        reserved_by_current_user=(current_user_id == res.user_id),
    )


@router.get("/{product_id}/reservation", response_model=ProductLockStatus)
def get_product_reservation_status(
    product_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User | None, Depends(get_current_user)] = None,
):
    product = crud_product.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    active = crud_reservation.get_active_reservation(db, product_id)
    if not active:
        return ProductLockStatus(is_locked=False, remaining_seconds=0)

    now = datetime.utcnow()
    remaining = max(0, int((active.expires_at - now).total_seconds()))
    curr_id = current_user.id if current_user else None

    return ProductLockStatus(
        is_locked=True,
        reserved_by_user_id=active.user_id,
        reserved_by_current_user=(curr_id == active.user_id),
        expires_at=active.expires_at,
        remaining_seconds=remaining,
    )


@router.post("/{product_id}/reserve", response_model=ReservationResponse)
def reserve_product(
    product_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    payload: ReservationCreate = ReservationCreate(),
):
    product = crud_product.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    try:
        res = crud_reservation.create_or_extend_reservation(
            db=db,
            product=product,
            user=current_user,
            duration_minutes=payload.duration_minutes,
        )
        return _format_reservation_response(res, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.post("/{product_id}/release", response_model=dict)
def release_product_reservation(
    product_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    product = crud_product.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    try:
        success = crud_reservation.release_reservation(db, product_id, current_user)
        if not success:
            return {"message": "No active reservation found to release"}
        return {"message": "Reservation lock released successfully"}
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
