from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductUpdate


def get_product(db: Session, product_id: int) -> Product | None:
    return db.get(Product, product_id)


def get_products(db: Session, skip: int = 0, limit: int = 100) -> Sequence[Product]:
    stmt = select(Product).offset(skip).limit(limit)
    return db.scalars(stmt).all()


def create_product(db: Session, product_in: ProductCreate) -> Product:
    db_product = Product(
        name=product_in.name,
        description=product_in.description,
        price=product_in.price,
    )
    if product_in.category_ids:
        categories = db.scalars(
            select(Category).where(Category.id.in_(product_in.category_ids))
        ).all()
        db_product.categories.extend(categories)

    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


def update_product(db: Session, product: Product, product_in: ProductUpdate) -> Product:
    if product_in.name is not None:
        product.name = product_in.name
    if product_in.description is not None:
        product.description = product_in.description
    if product_in.price is not None:
        product.price = product_in.price

    if product_in.category_ids is not None:
        categories = db.scalars(
            select(Category).where(Category.id.in_(product_in.category_ids))
        ).all()
        product.categories = list(categories)

    db.commit()
    db.refresh(product)
    return product


def delete_product(db: Session, product: Product) -> None:
    db.delete(product)
    db.commit()


def assign_category_to_product(db: Session, product: Product, category: Category) -> bool:
    if category not in product.categories:
        product.categories.append(category)
        db.commit()
        db.refresh(product)
        return True
    return False


def remove_category_from_product(db: Session, product: Product, category: Category) -> bool:
    if category in product.categories:
        product.categories.remove(category)
        db.commit()
        db.refresh(product)
        return True
    return False
