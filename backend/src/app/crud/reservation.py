from datetime import datetime, timedelta
from sqlalchemy import and_, func, select
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


def count_active_reservations(db: Session, product_id: int) -> int:
    """Count active (non-expired) reservations for a product."""
    now = datetime.utcnow()
    result = db.scalar(
        select(func.count()).where(
            and_(
                Reservation.product_id == product_id,
                Reservation.status == "active",
                Reservation.expires_at > now,
            )
        )
    )
    return result or 0


def get_active_reservation(db: Session, product_id: int) -> Reservation | None:
    """Get the most recent active reservation for a product (the lock holder)."""
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


def get_user_active_reservation(db: Session, product_id: int, user_id: int) -> Reservation | None:
    """Get active reservation for a specific user on a product."""
    expire_stale_reservations(db, product_id=product_id)
    now = datetime.utcnow()
    return db.scalar(
        select(Reservation).where(
            and_(
                Reservation.product_id == product_id,
                Reservation.user_id == user_id,
                Reservation.status == "active",
                Reservation.expires_at > now,
            )
        )
    )


def create_or_extend_reservation(
    db: Session,
    product: Product,
    user: User,
    duration_minutes: int = 5,
) -> Reservation:
    expire_stale_reservations(db, product_id=product.id)

    # Check if user already has an active reservation — extend it
    existing = get_user_active_reservation(db, product.id, user.id)
    if existing:
        existing.expires_at = datetime.utcnow() + timedelta(minutes=duration_minutes)
        db.commit()
        db.refresh(existing)
        return existing

    # Check stock availability
    active_count = count_active_reservations(db, product.id)
    if active_count >= product.stock:
        raise ValueError(
            f"No stock available to reserve. "
            f"{product.stock} in stock, {active_count} currently reserved."
        )

    reservation = Reservation(
        product_id=product.id,
        user_id=user.id,
        status="active",
        expires_at=datetime.utcnow() + timedelta(minutes=duration_minutes),
        created_at=datetime.utcnow(),
    )
    db.add(reservation)
    db.commit()
    db.refresh(reservation)
    return reservation


def release_reservation(db: Session, product_id: int, user: User) -> bool:
    existing = get_user_active_reservation(db, product_id, user.id)
    if not existing:
        if user.role == "admin":
            # Admin can release any active reservation
            existing = get_active_reservation(db, product_id)
        if not existing:
            return False

    if existing.user_id != user.id and user.role != "admin":
        raise PermissionError("You cannot release a lock owned by another user.")

    existing.status = "released"
    db.commit()
    return True
