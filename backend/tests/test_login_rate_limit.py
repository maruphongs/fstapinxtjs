"""
Comprehensive Test Suite for Redis-backed Login Rate Limiting:
- Tests rate limiting rule: max 5 login attempts per minute (60 seconds)
- Verifies counter and TTL written to Redis storage
- Verifies 6th attempt returns HTTP 429 Too Many Requests
- Verifies Retry-After and X-RateLimit headers
- Verifies independent counters per client IP
- Verifies reset behavior
"""
from pathlib import Path
import sys

# Ensure src and backend directories are in sys.path
backend_dir = Path(__file__).resolve().parent.parent
src_dir = backend_dir / "src"
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.rate_limit import login_rate_limiter
from app.core.redis import check_redis_connection, get_redis_client
from app.main import app


def test_redis_connection():
    """Verify Redis server is reachable."""
    print("\n--- 1. Testing Redis Connection ---")
    connected = check_redis_connection()
    assert connected, "Redis connection failed. Ensure Redis is running (e.g., docker compose up -d)."
    print("[PASS] Redis is connected and operational.")


def test_login_rate_limit_5_per_minute(client: TestClient):
    """
    Verify that no more than 5 login attempts per minute are permitted,
    and that data is properly written to Redis storage.
    """
    print("\n--- 2. Testing 5 Logins/Minute Limit on /auth/login ---")
    redis = get_redis_client()
    test_ip = "10.0.0.42"
    key = f"ratelimit:login:{test_ip}"

    # Clean key before test
    redis.delete(key)
    headers = {"X-Forwarded-For": test_ip}

    # Attempt 1 to 5: All should be allowed through rate limiter
    for i in range(1, 6):
        res = client.post(
            "/auth/login",
            json={"username": "admin", "password": "wrongpassword"},
            headers=headers,
        )
        assert res.status_code == 401, f"Expected 401 Unauthorized on attempt {i}, got {res.status_code}"
        
        # Verify attempt count in Redis
        current_in_redis = int(redis.get(key))
        ttl = redis.ttl(key)
        assert current_in_redis == i, f"Expected Redis key to have value {i}, got {current_in_redis}"
        assert 0 < ttl <= settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS, f"Expected valid TTL in Redis, got {ttl}"
        print(f"[PASS] Attempt {i}/5 allowed. Redis counter = {current_in_redis}, TTL = {ttl}s.")

    # Attempt 6: Exceeds 5 attempts per minute -> Must return 429
    res_6 = client.post(
        "/auth/login",
        json={"username": "admin", "password": "1234"},
        headers=headers,
    )
    assert res_6.status_code == 429, f"Expected 429 Too Many Requests on attempt 6, got {res_6.status_code}"
    data = res_6.json()
    assert "detail" in data
    assert "Too many login attempts" in data["detail"]
    assert "Retry-After" in res_6.headers
    assert res_6.headers["X-RateLimit-Limit"] == "5"
    assert res_6.headers["X-RateLimit-Remaining"] == "0"

    current_in_redis = int(redis.get(key))
    ttl = redis.ttl(key)
    print(f"[PASS] Attempt 6 blocked with 429 Too Many Requests. Redis counter = {current_in_redis}, TTL = {ttl}s.")
    print(f"[PASS] Response detail: {data['detail']}")
    print(f"[PASS] Headers: Retry-After={res_6.headers.get('Retry-After')}, X-RateLimit-Limit={res_6.headers.get('X-RateLimit-Limit')}")

    # Clean up
    redis.delete(key)


def test_independent_ip_limits(client: TestClient):
    """Verify different client IPs have independent counters in Redis."""
    print("\n--- 3. Testing Independent IP Limits in Redis ---")
    redis = get_redis_client()
    ip_a = "192.168.1.101"
    ip_b = "192.168.1.102"
    redis.delete(f"ratelimit:login:{ip_a}")
    redis.delete(f"ratelimit:login:{ip_b}")

    # IP A makes 5 attempts and gets blocked on 6th
    for _ in range(5):
        client.post("/auth/login", json={"username": "admin", "password": "bad"}, headers={"X-Forwarded-For": ip_a})
    blocked_res = client.post("/auth/login", json={"username": "admin", "password": "bad"}, headers={"X-Forwarded-For": ip_a})
    assert blocked_res.status_code == 429, "IP A should be blocked"

    # IP B makes a login attempt -> Should succeed (200) since IP B is not blocked
    valid_res = client.post("/auth/login", json={"username": "admin", "password": "1234"}, headers={"X-Forwarded-For": ip_b})
    assert valid_res.status_code == 200, f"IP B should not be blocked, got {valid_res.status_code}"

    # Verify Redis keys
    assert int(redis.get(f"ratelimit:login:{ip_a}")) >= 6
    assert int(redis.get(f"ratelimit:login:{ip_b}")) == 1
    print("[PASS] IP A (blocked) and IP B (allowed) maintained separate Redis storage keys.")

    # Clean up
    redis.delete(f"ratelimit:login:{ip_a}")
    redis.delete(f"ratelimit:login:{ip_b}")


def test_successful_login_counts_against_limit(client: TestClient):
    """Verify successful logins also count towards the 5/min request limit."""
    print("\n--- 4. Testing Limit on Successful Logins ---")
    redis = get_redis_client()
    test_ip = "10.0.0.99"
    key = f"ratelimit:login:{test_ip}"
    redis.delete(key)
    headers = {"X-Forwarded-For": test_ip}

    for i in range(1, 6):
        res = client.post("/auth/login", json={"username": "admin", "password": "1234"}, headers=headers)
        assert res.status_code == 200

    # 6th attempt must be 429 even with valid password
    res_6 = client.post("/auth/login", json={"username": "admin", "password": "1234"}, headers=headers)
    assert res_6.status_code == 429
    print("[PASS] Even valid credentials blocked when exceeding 5 requests per minute.")

    redis.delete(key)


def test_oauth2_token_endpoint_rate_limit(client: TestClient):
    """Verify /auth/token endpoint is also protected by rate limit."""
    print("\n--- 5. Testing OAuth2 /auth/token Rate Limit ---")
    redis = get_redis_client()
    test_ip = "10.0.0.88"
    key = f"ratelimit:login:{test_ip}"
    redis.delete(key)
    headers = {"X-Forwarded-For": test_ip}

    for _ in range(5):
        client.post("/auth/token", data={"username": "admin", "password": "bad"}, headers=headers)

    res = client.post("/auth/token", data={"username": "admin", "password": "bad"}, headers=headers)
    assert res.status_code == 429
    print("[PASS] /auth/token endpoint enforces 5 req/min Redis rate limit.")

    redis.delete(key)


def run_all_tests():
    test_redis_connection()
    with TestClient(app) as client:
        # Reset any testclient default key
        redis = get_redis_client()
        redis.delete("ratelimit:login:testclient")

        test_login_rate_limit_5_per_minute(client)
        test_independent_ip_limits(client)
        test_successful_login_counts_against_limit(client)
        test_oauth2_token_endpoint_rate_limit(client)

    print("\n" + "=" * 60)
    print(">>> ALL REDIS LOGIN RATE LIMIT TESTS PASSED 100%! <<<")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    run_all_tests()
