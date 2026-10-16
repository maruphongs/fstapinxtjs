from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from fastapi.staticfiles import StaticFiles

from app.api import api_router
from app.core.config import settings
from app.core.database import engine, init_db
from app.core.redis import check_redis_connection, close_redis_client
from app.graphql import graphql_router
from sqlalchemy import text


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure upload directories exist
    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    settings.THUMBNAIL_DIR.mkdir(parents=True, exist_ok=True)

    # Test access connections (verify database and redis connectivity on startup)
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    check_redis_connection()

    # Initialize database schemas and seed default users
    init_db()

    yield

    # Shutdown: clean up and dispose connections
    close_redis_client()
    engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "message": "API is running",
        "graphql": "/graphql",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
async def health_check():
    # Test database access connection
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    redis_ok = check_redis_connection()
    return {
        "status": "online",
        "database": "connected",
        "redis": "connected" if redis_ok else "unavailable",
    }



app.include_router(api_router, prefix=settings.API_PREFIX)
app.include_router(graphql_router, prefix="/graphql")

app.mount("/uploads", StaticFiles(directory=str(settings.UPLOAD_DIR)), name="uploads")
