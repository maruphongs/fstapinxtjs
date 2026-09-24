import strawberry
from strawberry.exceptions import StrawberryGraphQLError

from app.auth.security import create_access_token
from app.crud import category as crud_category
from app.crud import product as crud_product
from app.crud import user as crud_user
from app.graphql.context import require_admin_from_info
from app.graphql.types import (
    AuthPayload,
    CategoryCreateInput,
    CategoryType,
    CategoryUpdateInput,
    ProductCreateInput,
    ProductType,
    ProductUpdateInput,
    UserCreateInput,
    UserType,
    UserUpdateInput,
)
from app.schemas.auth import UserRegister
from app.schemas.category import CategoryCreate, CategoryUpdate
from app.schemas.product import ProductCreate, ProductUpdate


@strawberry.type
class Mutation:
    # ---------------- Product Mutations ----------------

    @strawberry.mutation(description="Create a new product (Admin only)")
    def create_product(
        self,
        info: strawberry.Info,
        input: ProductCreateInput,
    ) -> ProductType:
        require_admin_from_info(info)
        db = info.context.db

        product_in = ProductCreate(
            name=input.name,
            description=input.description,
            price=input.price,
            category_ids=input.category_ids or [],
        )
        created = crud_product.create_product(db, product_in)
        return ProductType.from_db(created)

    @strawberry.mutation(description="Update an existing product (Admin only)")
    def update_product(
        self,
        info: strawberry.Info,
        id: int,
        input: ProductUpdateInput,
    ) -> ProductType:
        require_admin_from_info(info)
        db = info.context.db

        product = crud_product.get_product(db, product_id=id)
        if not product:
            raise StrawberryGraphQLError(f"Product with ID {id} not found.")

        product_in = ProductUpdate(
            name=input.name,
            description=input.description,
            price=input.price,
            category_ids=input.category_ids,
        )
        updated = crud_product.update_product(db, product, product_in)
        return ProductType.from_db(updated)

    @strawberry.mutation(description="Delete a product by ID (Admin only)")
    def delete_product(self, info: strawberry.Info, id: int) -> bool:
        require_admin_from_info(info)
        db = info.context.db

        product = crud_product.get_product(db, product_id=id)
        if not product:
            raise StrawberryGraphQLError(f"Product with ID {id} not found.")

        crud_product.delete_product(db, product)
        return True

    @strawberry.mutation(description="Assign a category to a product (Admin only)")
    def assign_category_to_product(
        self,
        info: strawberry.Info,
        product_id: int,
        category_id: int,
    ) -> ProductType:
        require_admin_from_info(info)
        db = info.context.db

        product = crud_product.get_product(db, product_id)
        if not product:
            raise StrawberryGraphQLError(f"Product with ID {product_id} not found.")

        category = crud_category.get_category(db, category_id)
        if not category:
            raise StrawberryGraphQLError(f"Category with ID {category_id} not found.")

        crud_product.assign_category_to_product(db, product, category)
        return ProductType.from_db(product)

    @strawberry.mutation(description="Remove a category from a product (Admin only)")
    def remove_category_from_product(
        self,
        info: strawberry.Info,
        product_id: int,
        category_id: int,
    ) -> ProductType:
        require_admin_from_info(info)
        db = info.context.db

        product = crud_product.get_product(db, product_id)
        if not product:
            raise StrawberryGraphQLError(f"Product with ID {product_id} not found.")

        category = crud_category.get_category(db, category_id)
        if not category:
            raise StrawberryGraphQLError(f"Category with ID {category_id} not found.")

        crud_product.remove_category_from_product(db, product, category)
        return ProductType.from_db(product)

    # ---------------- Category Mutations ----------------

    @strawberry.mutation(description="Create a new category (Admin only)")
    def create_category(
        self,
        info: strawberry.Info,
        input: CategoryCreateInput,
    ) -> CategoryType:
        require_admin_from_info(info)
        db = info.context.db

        existing = crud_category.get_category_by_name(db, name=input.name)
        if existing:
            raise StrawberryGraphQLError("Category name already exists.")

        cat_in = CategoryCreate(name=input.name)
        created = crud_category.create_category(db, cat_in)
        return CategoryType.from_db(created)

    @strawberry.mutation(description="Update an existing category (Admin only)")
    def update_category(
        self,
        info: strawberry.Info,
        id: int,
        input: CategoryUpdateInput,
    ) -> CategoryType:
        require_admin_from_info(info)
        db = info.context.db

        category = crud_category.get_category(db, category_id=id)
        if not category:
            raise StrawberryGraphQLError(f"Category with ID {id} not found.")

        existing = crud_category.get_category_by_name(db, name=input.name)
        if existing and existing.id != id:
            raise StrawberryGraphQLError("Category name already exists.")

        cat_in = CategoryUpdate(name=input.name)
        updated = crud_category.update_category(db, category, cat_in)
        return CategoryType.from_db(updated)

    @strawberry.mutation(description="Delete a category by ID (Admin only)")
    def delete_category(self, info: strawberry.Info, id: int) -> bool:
        require_admin_from_info(info)
        db = info.context.db

        category = crud_category.get_category(db, category_id=id)
        if not category:
            raise StrawberryGraphQLError(f"Category with ID {id} not found.")

        crud_category.delete_category(db, category)
        return True

    # ---------------- User Mutations ----------------

    @strawberry.mutation(description="Create a new user with specific role (Admin only)")
    def create_user(
        self,
        info: strawberry.Info,
        input: UserCreateInput,
    ) -> UserType:
        require_admin_from_info(info)
        db = info.context.db

        existing = crud_user.get_user_by_username(db, username=input.username)
        if existing:
            raise StrawberryGraphQLError("Username already registered.")

        user_in = UserRegister(username=input.username, password=input.password)
        role = input.role or "user"
        created = crud_user.create_user(db, user_in, role=role)
        return UserType.from_db(created)

    @strawberry.mutation(description="Update user role, active status, or password (Admin only)")
    def update_user(
        self,
        info: strawberry.Info,
        id: int,
        input: UserUpdateInput,
    ) -> UserType:
        current_admin = require_admin_from_info(info)
        db = info.context.db

        user = crud_user.get_user_by_id(db, user_id=id)
        if not user:
            raise StrawberryGraphQLError(f"User with ID {id} not found.")

        # Prevent admin from deactivating themselves
        if current_admin.id == id and input.is_active is False:
            raise StrawberryGraphQLError("Cannot deactivate your own admin account.")

        updated = crud_user.update_user(
            db,
            user,
            role=input.role,
            is_active=input.is_active,
            password=input.password,
        )
        return UserType.from_db(updated)

    @strawberry.mutation(description="Delete a user by ID (Admin only)")
    def delete_user(self, info: strawberry.Info, id: int) -> bool:
        current_admin = require_admin_from_info(info)
        db = info.context.db

        if current_admin.id == id:
            raise StrawberryGraphQLError("Cannot delete your own account.")

        user = crud_user.get_user_by_id(db, user_id=id)
        if not user:
            raise StrawberryGraphQLError(f"User with ID {id} not found.")

        crud_user.delete_user(db, user)
        return True

    # ---------------- Auth Mutations ----------------

    @strawberry.mutation(description="Authenticate user and obtain JWT access token")
    def login(
        self,
        info: strawberry.Info,
        username: str,
        password: str,
    ) -> AuthPayload:
        db = info.context.db
        user = crud_user.authenticate_user(db, username=username, password=password)
        if not user:
            raise StrawberryGraphQLError("Incorrect username or password.")
        if not user.is_active:
            raise StrawberryGraphQLError("User account is inactive.")

        token = create_access_token(data={"sub": user.username, "role": user.role})
        return AuthPayload(
            access_token=token,
            token_type="bearer",
            user=UserType.from_db(user),
        )

    @strawberry.mutation(description="Register a new user account")
    def register(
        self,
        info: strawberry.Info,
        username: str,
        password: str,
    ) -> AuthPayload:
        db = info.context.db
        existing = crud_user.get_user_by_username(db, username=username)
        if existing:
            raise StrawberryGraphQLError("Username already registered.")

        user_in = UserRegister(username=username, password=password)
        user = crud_user.create_user(db, user_in, role="user")

        token = create_access_token(data={"sub": user.username, "role": user.role})
        return AuthPayload(
            access_token=token,
            token_type="bearer",
            user=UserType.from_db(user),
        )
