from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud import category as crud_category
from app.crud import product as crud_product
from app.schemas.common import RelationshipResponse
from app.schemas.product import ProductCreate, ProductResponse, ProductUpdate

router = APIRouter(
    prefix="/products",
    tags=["Products"],
)


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    product_in: ProductCreate,
    db: Annotated[Session, Depends(get_db)],
):
    return crud_product.create_product(db, product_in)


@router.get("/", response_model=list[ProductResponse])
def get_products(
    db: Annotated[Session, Depends(get_db)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    return crud_product.get_products(db, skip=skip, limit=limit)


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    product = crud_product.get_product(db, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    product_in: ProductUpdate,
    db: Annotated[Session, Depends(get_db)],
):
    product = crud_product.get_product(db, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    return crud_product.update_product(db, product, product_in)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    product = crud_product.get_product(db, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    crud_product.delete_product(db, product)
    return None


@router.post(
    "/{product_id}/categories/{category_id}",
    response_model=RelationshipResponse,
)
def add_product_category(
    product_id: int,
    category_id: int,
    db: Annotated[Session, Depends(get_db)],
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
    "/{product_id}/categories/{category_id}",
    response_model=RelationshipResponse,
)
def remove_product_category(
    product_id: int,
    category_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    product = crud_product.get_product(db, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    category = crud_category.get_category(db, category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    if category not in product.categories:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product is not assigned to category",
        )

    crud_product.remove_category_from_product(db, product, category)
    return {"message": "Category removed from product"}
