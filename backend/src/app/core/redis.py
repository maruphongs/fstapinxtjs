import logging
import redis
from app.core.config import settings

logger = logging.getLogger("app.redis")

_redis_client: redis.Redis | None = None


def get_redis_client() -> redis.Redis:
    """Return a shared Redis client instance."""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=2.0,
            socket_timeout=2.0,
        )
    return _redis_client


def close_redis_client() -> None:
    """Safely close the Redis client connection."""
    global _redis_client
    if _redis_client is not None:
        try:
            _redis_client.close()
        except Exception as e:
            logger.warning(f"Error closing Redis client: {e}")
        _redis_client = None


def check_redis_connection() -> bool:
    """Ping Redis to verify active connection."""
    try:
        client = get_redis_client()
        return client.ping() is True
    except Exception as e:
        logger.warning(f"Redis connection check failed: {e}")
        return False
