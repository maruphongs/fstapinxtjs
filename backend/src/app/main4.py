from typing import Annotated

from backend.database import Base, engine, get_db
from backend.model import Category, Product
from backend.schema import (
    CategoryCreate,
    CategoryResponse,
    ProductCreate,
    ProductResponse,
    RelationshipResponse,
)
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

# Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Product Catalog API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Product Catalog API is running"}


@app.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def add_product(product: ProductCreate, db: Annotated[Session, Depends(get_db)]):
    db_product = Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


@app.get("/products", response_model=list[ProductResponse])
async def get_products(db: Annotated[Session, Depends(get_db)]):
    return db.query(Product).all()


@app.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: int, db: Annotated[Session, Depends(get_db)]):
    product = db.query(Product).filter(Product.id == product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@app.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int, product_data: ProductCreate, db: Annotated[Session, Depends(get_db)]
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    for key, value in product_data.model_dump().items():
        setattr(product, key, value)
    db.commit()
    db.refresh(product)
    return product


@app.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(product_id: int, db: Annotated[Session, Depends(get_db)]):
    product = db.query(Product).filter(Product.id == product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(product)
    db.commit()


@app.post(
    "/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED
)
async def add_category(category: CategoryCreate, db: Annotated[Session, Depends(get_db)]):
    db_category = Category(**category.model_dump())
    db.add(db_category)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Category name already exists")
    db.refresh(db_category)
    return db_category


@app.get("/categories", response_model=list[CategoryResponse])
async def get_categories(db: Annotated[Session, Depends(get_db)]):
    return db.query(Category).all()


@app.get("/categories/{category_id}", response_model=CategoryResponse)
async def get_category(category_id: int, db: Annotated[Session, Depends(get_db)]):
    category = db.query(Category).filter(Category.id == category_id).first()
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@app.put("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    category_data: CategoryCreate,
    db: Annotated[Session, Depends(get_db)],
):
    category = db.query(Category).filter(Category.id == category_id).first()
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")

    category.name = category_data.name
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Category name already exists")
    db.refresh(category)
    return category


@app.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(category_id: int, db: Annotated[Session, Depends(get_db)]):
    category = db.query(Category).filter(Category.id == category_id).first()
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")

    db.delete(category)
    db.commit()


@app.post(
    "/products/{product_id}/categories/{category_id}",
    response_model=RelationshipResponse,
)
async def add_product_category(
    product_id: int, category_id: int, db: Annotated[Session, Depends(get_db)]
):
    product = db.query(Product).filter(Product.id == product_id).first()
    category = db.query(Category).filter(Category.id == category_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    if category not in product.categories:
        product.categories.append(category)
        db.commit()
    return {"message": "Category assigned to product"}


@app.delete(
    "/products/{product_id}/categories/{category_id}",
    response_model=RelationshipResponse,
)
async def remove_product_category(
    product_id: int, category_id: int, db: Annotated[Session, Depends(get_db)]
):
    product = db.query(Product).filter(Product.id == product_id).first()
    category = db.query(Category).filter(Category.id == category_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    if category not in product.categories:
        raise HTTPException(status_code=404, detail="Product is not assigned to category")

    product.categories.remove(category)
    db.commit()
    return {"message": "Category removed from product"}