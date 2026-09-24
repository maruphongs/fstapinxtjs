from typing import Optional

from sqlalchemy import select
import strawberry

from app.crud import category as crud_category
from app.crud import product as crud_product
from app.crud import user as crud_user
from app.graphql.context import (
    get_current_user_from_info,
    require_auth_from_info,
)
from app.graphql.types import CategoryType, ProductType, UserType
from app.models.category import Category
from app.models.product import Product


@strawberry.type
class Query:
    @strawberry.field(description="Retrieve a paginated list of products with optional search and category filters")
    def products(
        self,
        info: strawberry.Info,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        category_id: Optional[int] = None,
    ) -> list[ProductType]:
        db = info.context.db
        stmt = select(Product)

        if search:
            pattern = f"%{search.strip()}%"
            stmt = stmt.where(
                Product.name.ilike(pattern) | Product.description.ilike(pattern)
            )

        if category_id is not None:
            stmt = stmt.join(Product.categories).where(Category.id == category_id)

        stmt = stmt.order_by(Product.id.asc()).offset(skip).limit(limit)
        results = db.scalars(stmt).unique().all()
        return [ProductType.from_db(p) for p in results]

    @strawberry.field(description="Retrieve a single product by ID")
    def product(self, info: strawberry.Info, id: int) -> Optional[ProductType]:
        db = info.context.db
        p = crud_product.get_product(db, product_id=id)
        if not p:
            return None
        return ProductType.from_db(p)

    @strawberry.field(description="Retrieve a paginated list of categories with optional search")
    def categories(
        self,
        info: strawberry.Info,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
    ) -> list[CategoryType]:
        db = info.context.db
        stmt = select(Category)

        if search:
            pattern = f"%{search.strip()}%"
            stmt = stmt.where(Category.name.ilike(pattern))

        stmt = stmt.order_by(Category.id.asc()).offset(skip).limit(limit)
        results = db.scalars(stmt).unique().all()
        return [CategoryType.from_db(c) for c in results]

    @strawberry.field(description="Retrieve a single category by ID")
    def category(self, info: strawberry.Info, id: int) -> Optional[CategoryType]:
        db = info.context.db
        c = crud_category.get_category(db, category_id=id)
        if not c:
            return None
        return CategoryType.from_db(c)

    @strawberry.field(description="Retrieve a paginated list of all users (Authentication required)")
    def users(
        self,
        info: strawberry.Info,
        skip: int = 0,
        limit: int = 100,
    ) -> list[UserType]:
        require_auth_from_info(info)
        db = info.context.db
        users_list = crud_user.get_users(db, skip=skip, limit=limit)
        return [UserType.from_db(u) for u in users_list]

    @strawberry.field(description="Retrieve a single user by ID (Authentication required)")
    def user(self, info: strawberry.Info, id: int) -> Optional[UserType]:
        require_auth_from_info(info)
        db = info.context.db
        u = crud_user.get_user_by_id(db, user_id=id)
        if not u:
            return None
        return UserType.from_db(u)

    @strawberry.field(description="Retrieve currently authenticated user")
    def me(self, info: strawberry.Info) -> Optional[UserType]:
        current_user = get_current_user_from_info(info)
        if not current_user:
            return None
        return UserType.from_db(current_user)
