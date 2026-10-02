from pathlib import Path
import shutil
from typing import Annotated
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_admin_user
from app.core.config import settings
from app.core.database import get_db
from app.crud import category as crud_category
from app.crud import product as crud_product
from app.models.user import User
from app.schemas.common import RelationshipResponse
from app.schemas.product import ProductCreate, ProductResponse, ProductUpdate

router = APIRouter(
    prefix="/products",
    tags=["Products"],
)


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_product(
    product_in: ProductCreate,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin_user)],
):
    return crud_product.create_product(db, product_in)


@router.get("", response_model=list[ProductResponse])
@router.get("/", response_model=list[ProductResponse], include_in_schema=False)
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
    current_admin: Annotated[User, Depends(get_current_admin_user)],
):
    product = crud_product.get_product(db, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    return crud_product.update_product(db, product, product_in)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin_user)],
):
    product = crud_product.get_product(db, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    crud_product.delete_product(db, product)
    return { "message": "Product deleted successfully" }


@router.post(
    "/{product_id}/categories/{category_id}",
    response_model=RelationshipResponse,
)
def add_product_category(
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
    "/{product_id}/categories/{category_id}",
    response_model=RelationshipResponse,
)
def remove_product_category(
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product is not assigned to category",
        )

    crud_product.remove_category_from_product(db, product, category)
    return {"message": "Category removed from product"}


ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"}


def save_thumbnail_file(file: UploadFile, product_id: int | str = "temp") -> str:
    """Validate and save an uploaded thumbnail file to the thumbnail directory."""
    original_name = file.filename or "thumbnail.png"
    ext = Path(original_name).suffix.lower()

    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        if file.content_type and "jpeg" in file.content_type:
            ext = ".jpg"
        elif file.content_type and "png" in file.content_type:
            ext = ".png"
        elif file.content_type and "webp" in file.content_type:
            ext = ".webp"
        elif file.content_type and "gif" in file.content_type:
            ext = ".gif"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format '{ext}'. Allowed extensions: {', '.join(sorted(ALLOWED_IMAGE_EXTENSIONS))}",
            )

    settings.THUMBNAIL_DIR.mkdir(parents=True, exist_ok=True)
    unique_name = f"product_{product_id}_{uuid.uuid4().hex[:12]}{ext}"
    dest_path = settings.THUMBNAIL_DIR / unique_name

    try:
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save thumbnail file: {str(e)}",
        )

    return f"/uploads/thumbnails/{unique_name}"


@router.post(
    "/{product_id}/thumbnail",
    response_model=ProductResponse,
    summary="Upload product thumbnail image",
)
@router.post(
    "/{product_id}/upload-thumbnail",
    response_model=ProductResponse,
    include_in_schema=False,
)
@router.put(
    "/{product_id}/thumbnail",
    response_model=ProductResponse,
    include_in_schema=False,
)
def upload_product_thumbnail(
    product_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin_user)],
    file: Annotated[UploadFile | None, File(description="Product thumbnail file")] = None,
    thumbnail: Annotated[UploadFile | None, File(description="Alternative field name for thumbnail file")] = None,
):
    upload_file = file or thumbnail
    if upload_file is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Thumbnail file is required (use 'file' or 'thumbnail' form field)",
        )

    product = crud_product.get_product(db, product_id)
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    # Clean up existing thumbnail file if stored locally
    if product.thumbnail and product.thumbnail.startswith("/uploads/thumbnails/"):
        old_filename = Path(product.thumbnail).name
        old_file = settings.THUMBNAIL_DIR / old_filename
        if old_file.is_file():
            try:
                old_file.unlink()
            except OSError:
                pass

    thumbnail_url = save_thumbnail_file(upload_file, product_id=product_id)
    return crud_product.update_product_thumbnail(db, product, thumbnail_url)


@router.delete(
    "/{product_id}/thumbnail",
    response_model=ProductResponse,
    summary="Delete product thumbnail image",
)
def delete_product_thumbnail(
    product_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin_user)],
):
    product = crud_product.get_product(db, product_id)
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    if product.thumbnail and product.thumbnail.startswith("/uploads/thumbnails/"):
        old_filename = Path(product.thumbnail).name
        old_file = settings.THUMBNAIL_DIR / old_filename
        if old_file.is_file():
            try:
                old_file.unlink()
            except OSError:
                pass

    return crud_product.update_product_thumbnail(db, product, None)


@router.post(
    "/upload-thumbnail",
    summary="Upload a standalone thumbnail image",
)
def upload_standalone_thumbnail(
    current_admin: Annotated[User, Depends(get_current_admin_user)],
    file: Annotated[UploadFile | None, File(description="Thumbnail file")] = None,
    thumbnail: Annotated[UploadFile | None, File(description="Alternative field name for thumbnail file")] = None,
):
    upload_file = file or thumbnail
    if upload_file is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Thumbnail file is required",
        )
    thumbnail_url = save_thumbnail_file(upload_file, product_id="new")
    return {
        "thumbnail": thumbnail_url,
        "thumbnail_url": thumbnail_url,
        "filename": Path(thumbnail_url).name,
    }

