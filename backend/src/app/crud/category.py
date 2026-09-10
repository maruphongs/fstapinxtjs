from collections.abc import Sequence
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate


def get_category(db: Session, category_id: int) -> Category | None:
    return db.get(Category, category_id)


def get_category_by_name(db: Session, name: str) -> Category | None:
    stmt = select(Category).where(Category.name == name)
    return db.scalar(stmt)


def get_categories(db: Session, skip: int = 0, limit: int = 100) -> Sequence[Category]:
    stmt = select(Category).offset(skip).limit(limit)
    return db.scalars(stmt).all()


def create_category(db: Session, category_in: CategoryCreate) -> Category:
    db_category = Category(name=category_in.name)
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category


def update_category(db: Session, category: Category, category_in: CategoryUpdate) -> Category:
    if category_in.name is not None:
        category.name = category_in.name
    db.commit()
    db.refresh(category)
    return category


def delete_category(db: Session, category: Category) -> None:
    db.delete(category)
    db.commit()
