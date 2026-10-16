import logging
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
import redis

from app.core.config import settings
from app.core.redis import get_redis_client

logger = logging.getLogger("app.rate_limit")


def get_client_ip(request: Request) -> str:
    """Extract client IP address from proxy headers or client connection."""
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


class RateLimiter:
    """
    Redis-backed Rate Limiter.
    Limits actions to `max_attempts` per `window_seconds`.
    Writes state to Redis storage:
      - Key: {prefix}:{identifier}
      - Value: Atomic integer counter of attempts
      - TTL: Remaining seconds until the window resets
    """

    def __init__(
        self,
        max_attempts: int = 5,
        window_seconds: int = 60,
        prefix: str = "ratelimit:login",
    ):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.prefix = prefix

    def get_key(self, identifier: str) -> str:
        return f"{self.prefix}:{identifier}"

    def check_rate_limit(
        self,
        identifier: str,
        client: redis.Redis | None = None,
    ) -> tuple[int, int]:
        """
        Record an attempt in Redis and verify against the limit.
        Returns (current_attempts, remaining_ttl).
        Raises HTTPException(429) if max_attempts is exceeded.
        """
        if client is None:
            client = get_redis_client()

        key = self.get_key(identifier)

        try:
            # Atomic increment and TTL lookup using Redis pipeline
            pipe = client.pipeline()
            pipe.incr(key)
            pipe.ttl(key)
            results = pipe.execute()
            current_attempts: int = int(results[0])
            ttl: int = int(results[1])

            # Set TTL window on the first attempt or if key lacks TTL
            if current_attempts == 1 or ttl == -1:
                client.expire(key, self.window_seconds)
                ttl = self.window_seconds

            logger.info(
                f"Rate limit check for '{identifier}': {current_attempts}/{self.max_attempts} "
                f"(TTL: {ttl}s, Redis key: {key})"
            )

            if current_attempts > self.max_attempts:
                retry_after = ttl if ttl > 0 else self.window_seconds
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        f"Too many login attempts. Limit is {self.max_attempts} attempts "
                        f"per {self.window_seconds} seconds. Please try again in {retry_after} seconds."
                    ),
                    headers={
                        "Retry-After": str(retry_after),
                        "X-RateLimit-Limit": str(self.max_attempts),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": str(retry_after),
                    },
                )

            return current_attempts, ttl

        except HTTPException:
            raise
        except redis.RedisError as e:
            # Log Redis failure but don't hard-crash the endpoint if Redis is unreachable
            logger.warning(f"Redis rate limit check error for '{identifier}': {e}")
            return 1, self.window_seconds

    def reset(self, identifier: str, client: redis.Redis | None = None) -> None:
        """Clear rate limit key for identifier in Redis."""
        if client is None:
            client = get_redis_client()
        key = self.get_key(identifier)
        try:
            client.delete(key)
        except Exception as e:
            logger.warning(f"Error resetting rate limit key '{key}': {e}")

    def __call__(self, request: Request) -> None:
        """FastAPI dependency callable."""
        client_ip = get_client_ip(request)
        self.check_rate_limit(client_ip)


# Pre-configured instance: 5 attempts per 60 seconds (1 minute)
login_rate_limiter = RateLimiter(
    max_attempts=settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    window_seconds=settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
    prefix="ratelimit:login",
)
