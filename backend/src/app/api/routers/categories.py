from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_admin_user
from app.core.database import get_db
from app.crud import category as crud_category
from app.crud import product as crud_product
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate
from app.schemas.common import RelationshipResponse

router = APIRouter(
    prefix="/categories",
    tags=["Categories"],
)


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_category(
    category_in: CategoryCreate,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin_user)],
):
    existing = crud_category.get_category_by_name(db, category_in.name)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category name already exists")

    try:
        return crud_category.create_category(db, category_in)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category name already exists")


@router.get("", response_model=list[CategoryResponse])
@router.get("/", response_model=list[CategoryResponse], include_in_schema=False)
def get_categories(
    db: Annotated[Session, Depends(get_db)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    return crud_category.get_categories(db, skip=skip, limit=limit)


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    category = crud_category.get_category(db, category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return category


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    category_in: CategoryUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin_user)],
):
    category = crud_category.get_category(db, category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    if category_in.name and category_in.name != category.name:
        existing = crud_category.get_category_by_name(db, category_in.name)
        if existing and existing.id != category_id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category name already exists")

    try:
        return crud_category.update_category(db, category, category_in)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category name already exists")


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin_user)],
):
    category = crud_category.get_category(db, category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    crud_category.delete_category(db, category)
    return { "message": "Category deleted successfully" }


# Backwards-compatibility alias for legacy clients that called /categories/products/...
@router.post(
    "/products/{product_id}/categories/{category_id}",
    response_model=RelationshipResponse,
    include_in_schema=False,
)
def add_product_category_legacy(
    product_id: int,
    category_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin_user)],
):
    product = crud_product.get_product(db, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    category = crud_category.get_category(db, category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    crud_product.assign_category_to_product(db, product, category)
    return {"message": "Category assigned to product"}


@router.delete(
    "/products/{product_id}/categories/{category_id}",
    response_model=RelationshipResponse,
    include_in_schema=False,
)
def remove_product_category_legacy(
    product_id: int,
    category_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin_user)],
):
    product = crud_product.get_product(db, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    category = crud_category.get_category(db, category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    if category not in product.categories:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product is not assigned to category")

    crud_product.remove_category_from_product(db, product, category)
    return {"message": "Category removed from product"}
