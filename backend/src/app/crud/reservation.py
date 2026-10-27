from datetime import datetime, timedelta
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.reservation import Reservation
from app.models.user import User


def expire_stale_reservations(db: Session, product_id: int | None = None) -> None:
    """Mark past-due active reservations as expired."""
    now = datetime.utcnow()
    query = select(Reservation).where(
        and_(
            Reservation.status == "active",
            Reservation.expires_at <= now,
        )
    )
    if product_id is not None:
        query = query.where(Reservation.product_id == product_id)
    
    stale = db.scalars(query).all()
    for res in stale:
        res.status = "expired"
    if stale:
        db.commit()


def get_active_reservation(db: Session, product_id: int) -> Reservation | None:
    expire_stale_reservations(db, product_id=product_id)
    now = datetime.utcnow()
    stmt = (
        select(Reservation)
        .where(
            and_(
                Reservation.product_id == product_id,
                Reservation.status == "active",
                Reservation.expires_at > now,
            )
        )
        .order_by(Reservation.id.desc())
    )
    return db.scalar(stmt)


def create_or_extend_reservation(
    db: Session,
    product: Product,
    user: User,
    duration_minutes: int = 5,
) -> Reservation:
    expire_stale_reservations(db, product_id=product.id)
    active = get_active_reservation(db, product_id=product.id)
    
    now = datetime.utcnow()
    expires_at = now + timedelta(minutes=duration_minutes)

    if active:
        if active.user_id != user.id:
            raise ValueError("Product is currently reserved and locked by another user.")
        # If active by same user, extend expiration
        active.expires_at = expires_at
        db.commit()
        db.refresh(active)
        return active

    reservation = Reservation(
        product_id=product.id,
        user_id=user.id,
        status="active",
        expires_at=expires_at,
        created_at=now,
    )
    db.add(reservation)
    db.commit()
    db.refresh(reservation)
    return reservation


def release_reservation(db: Session, product_id: int, user: User) -> bool:
    active = get_active_reservation(db, product_id=product_id)
    if not active:
        return False
    if active.user_id != user.id and user.role != "admin":
        raise PermissionError("You cannot release a lock owned by another user.")
    
    active.status = "released"
    db.commit()
    return True
