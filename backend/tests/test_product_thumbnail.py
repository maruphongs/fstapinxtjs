"""
Comprehensive test suite for Product project:
- Lifespan contextmanager with test access connections
- Test case function for unauthorized access (401 & 403)
- Test case function for removing product thumbnails (REST DELETE and PUT)
- End-to-end product thumbnail verification suite
"""
import io
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
from app.main import app


def _get_client(client: TestClient | None = None):
    if client is not None:
        return client, None
    cm = TestClient(app)
    c = cm.__enter__()
    return c, cm


def test_access_connections(client: TestClient | None = None):
    """
    Test access connections and verify lifespan contextmanager startup.
    Ensures database connectivity, health endpoints, and core routes are operational.
    """
    c, cm = _get_client(client)
    try:
        print("\n--- Running test_access_connections ---")

        # 1. Test root service endpoint
        res = c.get("/")
        assert res.status_code == 200, f"Root endpoint failed: {res.text}"
        data = res.json()
        assert data.get("message") == "API is running"
        print("[PASS] Root API endpoint is active.")

        # 2. Test database connection health check (lifespan access connection)
        health_res = c.get("/health")
        assert health_res.status_code == 200, f"Health check failed: {health_res.text}"
        health_data = health_res.json()
        assert health_data.get("status") == "online"
        assert health_data.get("database") == "connected"
        print("[PASS] Database access connection verified via lifespan health check.")

        # 3. Test public read access to products
        prods_res = c.get("/products")
        assert prods_res.status_code == 200, f"Products GET failed: {prods_res.text}"
        assert isinstance(prods_res.json(), list)
        print(f"[PASS] Public read access to /products verified ({len(prods_res.json())} products).")

        # 4. Test public read access to categories
        cats_res = c.get("/categories")
        assert cats_res.status_code == 200, f"Categories GET failed: {cats_res.text}"
        assert isinstance(cats_res.json(), list)
        print(f"[PASS] Public read access to /categories verified ({len(cats_res.json())} categories).")

        print("[PASS] All access connections verified successfully.")
    finally:
        if cm is not None:
            cm.__exit__(None, None, None)


def test_unauthorized_access(client: TestClient | None = None):
    """
    Test unauthorized and unauthenticated access across protected product endpoints.
    Verifies that requests without a token or with an invalid token receive 401 Unauthorized,
    and requests from non-admin users receive 403 Forbidden.
    """
    c, cm = _get_client(client)
    try:
        print("\n--- Running test_unauthorized_access ---")

        # 1. Access without token -> Expect 401 Unauthorized
        res_create_no_token = c.post(
            "/products",
            json={"name": "Hacker Gadget", "price": 10.0},
        )
        assert res_create_no_token.status_code == 401, (
            f"Expected 401 for unauthenticated product create, got {res_create_no_token.status_code}"
        )
        print("[PASS] Unauthenticated product creation rejected with 401 Unauthorized.")

        # 2. Access with invalid / forged token -> Expect 401 Unauthorized
        bad_headers = {"Authorization": "Bearer invalid.fake.token"}
        res_bad_token = c.post(
            "/products",
            json={"name": "Hacker Gadget", "price": 10.0},
            headers=bad_headers,
        )
        assert res_bad_token.status_code == 401, (
            f"Expected 401 for invalid token, got {res_bad_token.status_code}"
        )
        print("[PASS] Invalid token access rejected with 401 Unauthorized.")

        # 3. Product update without token -> Expect 401 Unauthorized
        res_update_no_token = c.put("/products/1", json={"name": "Updated"})
        assert res_update_no_token.status_code == 401, (
            f"Expected 401 for unauthenticated product update, got {res_update_no_token.status_code}"
        )
        print("[PASS] Unauthenticated product update rejected with 401 Unauthorized.")

        # 4. Product deletion without token -> Expect 401 Unauthorized
        res_delete_no_token = c.delete("/products/1")
        assert res_delete_no_token.status_code == 401, (
            f"Expected 401 for unauthenticated product deletion, got {res_delete_no_token.status_code}"
        )
        print("[PASS] Unauthenticated product deletion rejected with 401 Unauthorized.")

        # 5. Thumbnail upload without token -> Expect 401 Unauthorized
        dummy_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
        res_thumb_no_token = c.post(
            "/products/1/thumbnail",
            files={"file": ("test.png", io.BytesIO(dummy_png), "image/png")},
        )
        assert res_thumb_no_token.status_code == 401, (
            f"Expected 401 for unauthenticated thumbnail upload, got {res_thumb_no_token.status_code}"
        )
        print("[PASS] Unauthenticated thumbnail upload rejected with 401 Unauthorized.")

        # 6. Thumbnail deletion without token -> Expect 401 Unauthorized
        res_del_thumb_no_token = c.delete("/products/1/thumbnail")
        assert res_del_thumb_no_token.status_code == 401, (
            f"Expected 401 for unauthenticated thumbnail deletion, got {res_del_thumb_no_token.status_code}"
        )
        print("[PASS] Unauthenticated thumbnail deletion rejected with 401 Unauthorized.")

        # 7. Non-admin (viewer) access -> Expect 403 Forbidden
        user_login = c.post("/auth/login", json={"username": "user", "password": "1234"})
        assert user_login.status_code == 200, "Viewer user login failed"
        viewer_token = user_login.json()["access_token"]
        viewer_headers = {"Authorization": f"Bearer {viewer_token}"}

        # Viewer cannot create products
        res_viewer_create = c.post(
            "/products",
            json={"name": "Viewer Product", "price": 19.99},
            headers=viewer_headers,
        )
        assert res_viewer_create.status_code == 403, (
            f"Expected 403 for viewer product creation, got {res_viewer_create.status_code}"
        )
        print("[PASS] Non-admin (viewer) product creation rejected with 403 Forbidden.")

        # Viewer cannot delete thumbnail
        res_viewer_del_thumb = c.delete("/products/1/thumbnail", headers=viewer_headers)
        assert res_viewer_del_thumb.status_code == 403, (
            f"Expected 403 for viewer thumbnail deletion, got {res_viewer_del_thumb.status_code}"
        )
        print("[PASS] Non-admin (viewer) thumbnail deletion rejected with 403 Forbidden.")

        print("[PASS] All unauthorized access test cases verified successfully.")
    finally:
        if cm is not None:
            cm.__exit__(None, None, None)


def test_remove_thumbnail(client: TestClient | None = None):
    """
    Test removing thumbnail from a product.
    Verifies that DELETE /products/{id}/thumbnail:
    - Clears product thumbnail in database to None
    - Deletes physical thumbnail file from disk
    - Works idempotently when product has no thumbnail
    - Also verifies PUT /products/{id} with thumbnail=None removes thumbnail and cleans up disk
    """
    c, cm = _get_client(client)
    try:
        print("\n--- Running test_remove_thumbnail ---")

        # Login as admin
        login_res = c.post("/auth/login", json={"username": "admin", "password": "1234"})
        assert login_res.status_code == 200, "Admin login failed"
        admin_headers = {"Authorization": f"Bearer {login_res.json()['access_token']}"}

        # 1. Create a test product
        create_res = c.post(
            "/products",
            json={"name": "Remove Thumb Item", "description": "Testing removal", "price": 25.0},
            headers=admin_headers,
        )
        assert create_res.status_code == 201
        prod_id = create_res.json()["id"]

        dummy_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"

        try:
            # 2. Upload thumbnail
            upload_res = c.post(
                f"/products/{prod_id}/thumbnail",
                files={"file": ("thumb1.png", io.BytesIO(dummy_bytes), "image/png")},
                headers=admin_headers,
            )
            assert upload_res.status_code == 200
            thumb_url = upload_res.json()["thumbnail"]
            assert thumb_url is not None
            filename = Path(thumb_url).name
            file_on_disk = settings.THUMBNAIL_DIR / filename
            assert file_on_disk.is_file(), "Uploaded thumbnail file must exist on disk"
            print(f"[PASS] Uploaded thumbnail: {thumb_url} (exists on disk).")

            # 3. Remove thumbnail via DELETE endpoint
            del_res = c.delete(f"/products/{prod_id}/thumbnail", headers=admin_headers)
            assert del_res.status_code == 200, f"Delete failed: {del_res.text}"
            del_data = del_res.json()
            assert del_data["thumbnail"] is None, "Thumbnail field must be None after delete"
            assert not file_on_disk.is_file(), "Thumbnail file must be removed from disk"
            print("[PASS] DELETE /products/{id}/thumbnail set thumbnail=None and deleted file from disk.")

            # 4. Verify GET returns None
            get_res = c.get(f"/products/{prod_id}")
            assert get_res.status_code == 200
            assert get_res.json()["thumbnail"] is None
            print("[PASS] GET confirmed product thumbnail is None.")

            # 5. Calling DELETE again when already None should succeed gracefully (idempotent)
            del_again_res = c.delete(f"/products/{prod_id}/thumbnail", headers=admin_headers)
            assert del_again_res.status_code == 200
            assert del_again_res.json()["thumbnail"] is None
            print("[PASS] Removing already-removed thumbnail succeeds gracefully.")

            # 6. Test removing thumbnail via PUT /products/{id} with thumbnail: null
            # First upload another thumbnail
            c.post(
                f"/products/{prod_id}/thumbnail",
                files={"file": ("thumb2.png", io.BytesIO(dummy_bytes), "image/png")},
                headers=admin_headers,
            )
            get_res2 = c.get(f"/products/{prod_id}")
            thumb_url2 = get_res2.json()["thumbnail"]
            assert thumb_url2 is not None
            file_on_disk2 = settings.THUMBNAIL_DIR / Path(thumb_url2).name
            assert file_on_disk2.is_file()

            # Now update with thumbnail=None in PUT
            put_res = c.put(
                f"/products/{prod_id}",
                json={"thumbnail": None},
                headers=admin_headers,
            )
            assert put_res.status_code == 200
            assert put_res.json()["thumbnail"] is None
            assert not file_on_disk2.is_file(), "File on disk must be cleaned up when thumbnail set to null in PUT"
            print("[PASS] PUT /products/{id} with thumbnail=None cleared thumbnail and deleted file from disk.")

        finally:
            c.delete(f"/products/{prod_id}", headers=admin_headers)

        print("[PASS] All thumbnail removal tests verified successfully.")
    finally:
        if cm is not None:
            cm.__exit__(None, None, None)


def test_product_thumbnail_suite(client: TestClient | None = None):
    c, cm = _get_client(client)
    try:
        print("\n--- Running Product Thumbnail UploadFile verification suite ---")

        # 1. Login as admin
        login_res = c.post(
            "/auth/login",
            json={"username": "admin", "password": "1234"},
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token = login_res.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {token}"}
        print("[PASS] Admin login successful.")

        # 2. Login as regular user (non-admin)
        user_login_res = c.post(
            "/auth/login",
            json={"username": "user", "password": "1234"},
        )
        assert user_login_res.status_code == 200, f"User login failed: {user_login_res.text}"
        user_token = user_login_res.json()["access_token"]
        user_headers = {"Authorization": f"Bearer {user_token}"}
        print("[PASS] Viewer user login successful.")

        # 3. Create a test product
        create_prod_res = c.post(
            "/products",
            json={
                "name": "Thumbnail Test Gadget",
                "description": "Product for testing thumbnail upload",
                "price": 49.99,
            },
            headers=admin_headers,
        )
        assert create_prod_res.status_code == 201, f"Product create failed: {create_prod_res.text}"
        prod = create_prod_res.json()
        prod_id = prod["id"]
        assert prod["thumbnail"] is None
        print(f"[PASS] Created test product (id={prod_id}) with thumbnail=None.")

        created_files: list[Path] = []

        try:
            # 4. Upload thumbnail via UploadFile using form field 'file'
            dummy_png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
            upload_res = c.post(
                f"/products/{prod_id}/thumbnail",
                files={"file": ("test_thumbnail.png", io.BytesIO(dummy_png_bytes), "image/png")},
                headers=admin_headers,
            )
            assert upload_res.status_code == 200, f"Upload failed: {upload_res.text}"
            data = upload_res.json()
            assert data["thumbnail"] is not None
            assert data["thumbnail"].startswith("/uploads/thumbnails/")
            thumb_url = data["thumbnail"]
            print(f"[PASS] Thumbnail uploaded successfully: {thumb_url}")

            # 5. Verify file exists on local filesystem
            filename = Path(thumb_url).name
            file_on_disk = settings.THUMBNAIL_DIR / filename
            assert file_on_disk.is_file(), f"File was not found on disk at {file_on_disk}"
            created_files.append(file_on_disk)
            print(f"[PASS] Thumbnail file verified on disk: {file_on_disk.name}")

            # 6. Verify StaticFiles serves the uploaded thumbnail over HTTP
            static_res = c.get(thumb_url)
            assert static_res.status_code == 200, f"Static serve failed: {static_res.status_code}"
            assert static_res.content == dummy_png_bytes
            print("[PASS] StaticFiles route /uploads correctly serves uploaded thumbnail.")

            # 7. Verify GET /products/{product_id} returns the thumbnail
            get_res = c.get(f"/products/{prod_id}")
            assert get_res.status_code == 200
            assert get_res.json()["thumbnail"] == thumb_url
            print("[PASS] GET /products/{id} returns updated thumbnail.")

            # 8. Upload replacement thumbnail via UploadFile using form field 'thumbnail'
            dummy_jpg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb"
            replace_res = c.post(
                f"/products/{prod_id}/thumbnail",
                files={"thumbnail": ("replaced.jpg", io.BytesIO(dummy_jpg_bytes), "image/jpeg")},
                headers=admin_headers,
            )
            assert replace_res.status_code == 200
            replaced_thumb_url = replace_res.json()["thumbnail"]
            assert replaced_thumb_url != thumb_url
            new_filename = Path(replaced_thumb_url).name
            new_file_on_disk = settings.THUMBNAIL_DIR / new_filename
            assert new_file_on_disk.is_file()
            created_files.append(new_file_on_disk)
            # Check that old thumbnail file was cleaned up
            assert not file_on_disk.is_file(), "Old thumbnail file should have been deleted upon replacement"
            print("[PASS] Thumbnail replaced and old file cleaned up.")

            # 9. Test rejection of invalid file extensions
            bad_res = c.post(
                f"/products/{prod_id}/thumbnail",
                files={"file": ("malicious.exe", io.BytesIO(b"MZ..."), "application/octet-stream")},
                headers=admin_headers,
            )
            assert bad_res.status_code == 400
            print("[PASS] Invalid file extension rejected with 400 Bad Request.")

            # 10. Test rejection when no file is sent
            empty_res = c.post(
                f"/products/{prod_id}/thumbnail",
                headers=admin_headers,
            )
            assert empty_res.status_code == 400
            print("[PASS] Missing file upload rejected with 400 Bad Request.")

            # 11. Test authorization (non-admin should be rejected)
            unauth_res = c.post(
                f"/products/{prod_id}/thumbnail",
                files={"file": ("unauth.png", io.BytesIO(dummy_png_bytes), "image/png")},
                headers=user_headers,
            )
            assert unauth_res.status_code == 403, f"Expected 403 for non-admin, got {unauth_res.status_code}"
            print("[PASS] Non-admin upload rejected with 403 Forbidden.")

            # 12. Test standalone thumbnail upload endpoint
            standalone_res = c.post(
                "/products/upload-thumbnail",
                files={"file": ("standalone.png", io.BytesIO(dummy_png_bytes), "image/png")},
                headers=admin_headers,
            )
            assert standalone_res.status_code == 200
            assert "thumbnail_url" in standalone_res.json()
            standalone_url = standalone_res.json()["thumbnail_url"]
            standalone_file = settings.THUMBNAIL_DIR / Path(standalone_url).name
            if standalone_file.is_file():
                created_files.append(standalone_file)
            print("[PASS] Standalone thumbnail upload endpoint verified.")

            # 13. Test DELETE /products/{product_id}/thumbnail
            del_thumb_res = c.delete(
                f"/products/{prod_id}/thumbnail",
                headers=admin_headers,
            )
            assert del_thumb_res.status_code == 200
            assert del_thumb_res.json()["thumbnail"] is None
            assert not new_file_on_disk.is_file(), "Thumbnail file should be deleted on DELETE"
            print("[PASS] DELETE /products/{id}/thumbnail clears column and deletes file.")

        finally:
            # Cleanup test product
            c.delete(f"/products/{prod_id}", headers=admin_headers)
            # Cleanup any remaining test files
            for f in created_files:
                if f.is_file():
                    try:
                        f.unlink()
                    except OSError:
                        pass
            print(f"[PASS] Cleaned up test product (id={prod_id}).")

        print("\n>>> ALL PRODUCT THUMBNAIL UPLOADFILE VERIFICATIONS PASSED 100%! <<<\n")
    finally:
        if cm is not None:
            cm.__exit__(None, None, None)


if __name__ == "__main__":
    with TestClient(app) as test_client:
        from app.core.rate_limit import login_rate_limiter
        login_rate_limiter.reset("testclient")
        print("=" * 60)

        print("PRODUCT PROJECT TEST SUITE (WITH LIFESPAN CONTEXTMANAGER)")
        print("=" * 60)
        test_access_connections(test_client)
        test_unauthorized_access(test_client)
        test_remove_thumbnail(test_client)
        test_product_thumbnail_suite(test_client)
        print("=" * 60)
        print(">>> ALL VERIFICATIONS COMPLETED AND PASSED SUCCESSFULLY! <<<")
        print("=" * 60)
