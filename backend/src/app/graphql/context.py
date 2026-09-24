from typing import Annotated, Any

from fastapi import Depends, Request
import jwt
from sqlalchemy.orm import Session
import strawberry
from strawberry.exceptions import StrawberryGraphQLError
from strawberry.fastapi import BaseContext

from app.core.config import settings
from app.core.database import get_db
from app.crud import user as crud_user
from app.models.user import User


class GraphQLContext(BaseContext):
    def __init__(
        self,
        request: Request,
        db: Session,
        current_user: User | None = None,
    ):
        super().__init__()
        self.request = request
        self.db = db
        self.current_user = current_user

    def __getitem__(self, item: str) -> Any:
        return getattr(self, item)


async def get_graphql_context(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> GraphQLContext:
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    current_user: User | None = None

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
            )
            username: str | None = payload.get("sub")
            if username:
                user = crud_user.get_user_by_username(db, username=username)
                if user and user.is_active:
                    current_user = user
        except Exception:
            current_user = None

    return GraphQLContext(
        request=request,
        db=db,
        current_user=current_user,
    )


def get_current_user_from_info(info: strawberry.Info) -> User | None:
    context: GraphQLContext = info.context
    return getattr(context, "current_user", None)


def require_auth_from_info(info: strawberry.Info) -> User:
    user = get_current_user_from_info(info)
    if not user:
        raise StrawberryGraphQLError("Authentication required. Please provide a valid Bearer token.")
    if not user.is_active:
        raise StrawberryGraphQLError("User account is inactive.")
    return user


def require_admin_from_info(info: strawberry.Info) -> User:
    user = require_auth_from_info(info)
    if user.role != "admin":
        raise StrawberryGraphQLError("Admin privileges required. Viewer accounts have read-only access.")
    return user
