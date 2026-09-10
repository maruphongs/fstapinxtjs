from pydantic import BaseModel, ConfigDict, Field
from app.schemas.common import CategorySummary, ProductSummary


class CategoryBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    products: list[ProductSummary] = Field(default_factory=list)


__all__ = [
    "CategoryBase",
    "CategoryCreate",
    "CategoryUpdate",
    "CategoryResponse",
    "CategorySummary",
]
