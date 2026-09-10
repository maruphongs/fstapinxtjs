"""
Compatibility module re-exporting all schemas.
"""
from app.schemas import (
    CategoryBase,
    CategoryCreate,
    CategoryResponse,
    CategorySummary,
    CategoryUpdate,
    MessageResponse,
    ProductBase,
    ProductCreate,
    ProductResponse,
    ProductSummary,
    ProductUpdate,
    RelationshipResponse,
)

__all__ = [
    "CategoryBase",
    "CategoryCreate",
    "CategoryResponse",
    "CategorySummary",
    "CategoryUpdate",
    "ProductBase",
    "ProductCreate",
    "ProductResponse",
    "ProductSummary",
    "ProductUpdate",
    "RelationshipResponse",
    "MessageResponse",
]
