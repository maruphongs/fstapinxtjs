from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ReservationCreate(BaseModel):
    duration_minutes: int = Field(default=5, ge=1, le=60)


class ReservationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    user_id: int
    status: str
    expires_at: datetime
    created_at: datetime
    is_expired: bool = False
    remaining_seconds: int = 0
    reserved_by_current_user: bool = False


class ProductLockStatus(BaseModel):
    is_locked: bool
    reserved_by_user_id: int | None = None
    reserved_by_current_user: bool = False
    expires_at: datetime | None = None
    remaining_seconds: int = 0
    stock: int = 0
    available_stock: int = 0
