from strawberry.fastapi import GraphQLRouter

from app.graphql.context import get_graphql_context
from app.graphql.schema import schema

graphql_router = GraphQLRouter(
    schema=schema,
    context_getter=get_graphql_context,
)

__all__ = ["graphql_router"]
