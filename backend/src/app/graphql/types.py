from typing import Optional
import strawberry

from app.models.category import Category as DBCategory
from app.models.product import Product as DBProduct
from app.models.user import User as DBUser


@strawberry.type
class CategoryType:
    id: int
    name: str

    @classmethod
    def from_db(cls, db_c: DBCategory) -> "CategoryType":
        instance = cls(id=db_c.id, name=db_c.name)
        setattr(instance, "_db_products", getattr(db_c, "products", []))
        return instance

    @strawberry.field(description="List of products associated with this category")
    def products(self) -> list["ProductType"]:
        raw_products = getattr(self, "_db_products", [])
        return [ProductType.from_db(p) for p in raw_products]


@strawberry.type
class ProductType:
    id: int
    name: str
    description: str
    price: float

    @classmethod
    def from_db(cls, db_p: DBProduct) -> "ProductType":
        instance = cls(
            id=db_p.id,
            name=db_p.name,
            description=db_p.description,
            price=db_p.price,
        )
        setattr(instance, "_db_categories", getattr(db_p, "categories", []))
        return instance

    @strawberry.field(description="List of categories associated with this product")
    def categories(self) -> list[CategoryType]:
        raw_cats = getattr(self, "_db_categories", [])
        return [CategoryType.from_db(c) for c in raw_cats]


@strawberry.type
class UserType:
    id: int
    username: str
    role: str
    is_active: bool

    @classmethod
    def from_db(cls, db_u: DBUser) -> "UserType":
        return cls(
            id=db_u.id,
            username=db_u.username,
            role=db_u.role,
            is_active=db_u.is_active,
        )


@strawberry.type
class AuthPayload:
    access_token: str
    token_type: str = "bearer"
    user: UserType


# ---------------- Input Types ----------------

@strawberry.input
class ProductCreateInput:
    name: str
    description: str
    price: float
    category_ids: Optional[list[int]] = None


@strawberry.input
class ProductUpdateInput:
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category_ids: Optional[list[int]] = None


@strawberry.input
class CategoryCreateInput:
    name: str


@strawberry.input
class CategoryUpdateInput:
    name: str


@strawberry.input
class UserCreateInput:
    username: str
    password: str
    role: Optional[str] = "user"


@strawberry.input
class UserUpdateInput:
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
