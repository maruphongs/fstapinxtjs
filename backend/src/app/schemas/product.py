from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import CategorySummary, ProductSummary


class ProductBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(default="")
    price: float = Field(ge=0)


class ProductCreate(ProductBase):
    category_ids: list[int] = Field(default_factory=list)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    price: float | None = Field(default=None, ge=0)
    category_ids: list[int] | None = None


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    price: float
    categories: list[CategorySummary] = Field(default_factory=list)


__all__ = [
    "ProductBase",
    "ProductCreate",
    "ProductResponse",
    "ProductSummary",
    "ProductUpdate",
]
