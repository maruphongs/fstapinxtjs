"""
Product Project Tests:
- Lifespan contextmanager with test access connections
- Unauthorized access test case function
- Product thumbnail removal test case function
"""
import sys
from pathlib import Path

# Ensure src and backend directories are in sys.path
backend_dir = Path(__file__).resolve().parent.parent
src_dir = backend_dir / "src"
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app

try:
    from tests.test_product_thumbnail import (
        test_access_connections,
        test_unauthorized_access,
        test_remove_thumbnail,
        test_product_thumbnail_suite,
    )
except ImportError:
    from test_product_thumbnail import (
        test_access_connections,
        test_unauthorized_access,
        test_remove_thumbnail,
        test_product_thumbnail_suite,
    )


def test_products_main():
    with TestClient(app) as client:
        from app.core.rate_limit import login_rate_limiter
        login_rate_limiter.reset("testclient")
        print("=" * 60)
        print("RUNNING PRODUCT PROJECT TESTS (LIFESPAN CONTEXTMANAGER)")
        print("=" * 60)

        test_access_connections(client)
        test_unauthorized_access(client)
        test_remove_thumbnail(client)
        test_product_thumbnail_suite(client)
        print("=" * 60)
        print(">>> ALL PRODUCT PROJECT TESTS PASSED! <<<")
        print("=" * 60)


if __name__ == "__main__":
    test_products_main()
