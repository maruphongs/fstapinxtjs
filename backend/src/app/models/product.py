from sqlalchemy import Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.associations import product_categories
from app.models.category import Category


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)

    categories: Mapped[list[Category]] = relationship(
        "Category",
        secondary=product_categories,
        back_populates="products",
        cascade="save-update",
    )


__all__ = ["Product", "Category", "product_categories"]