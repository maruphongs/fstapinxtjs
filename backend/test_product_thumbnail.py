import io
from pathlib import Path
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from starlette.testclient import TestClient

from app.core.config import settings
from app.core.database import init_db
from app.main import app

# Ensure database is initialized
init_db()

client = TestClient(app)


def test_product_thumbnail_suite():
    print("Starting Product Thumbnail UploadFile verification suite...\n")

    # 1. Login as admin
    login_res = client.post(
        "/auth/login",
        json={"username": "admin", "password": "1234"},
    )
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {token}"}
    print("[PASS] Admin login successful.")

    # 2. Login as regular user (non-admin)
    user_login_res = client.post(
        "/auth/login",
        json={"username": "user", "password": "1234"},
    )
    assert user_login_res.status_code == 200, f"User login failed: {user_login_res.text}"
    user_token = user_login_res.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}
    print("[PASS] Viewer user login successful.")

    # 3. Create a test product
    create_prod_res = client.post(
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
        upload_res = client.post(
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
        static_res = client.get(thumb_url)
        assert static_res.status_code == 200, f"Static serve failed: {static_res.status_code}"
        assert static_res.content == dummy_png_bytes
        print("[PASS] StaticFiles route /uploads correctly serves uploaded thumbnail.")

        # 7. Verify GET /products/{product_id} returns the thumbnail
        get_res = client.get(f"/products/{prod_id}")
        assert get_res.status_code == 200
        assert get_res.json()["thumbnail"] == thumb_url
        print("[PASS] GET /products/{id} returns updated thumbnail.")

        # 8. Upload replacement thumbnail via UploadFile using form field 'thumbnail'
        dummy_jpg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb"
        replace_res = client.post(
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
        bad_res = client.post(
            f"/products/{prod_id}/thumbnail",
            files={"file": ("malicious.exe", io.BytesIO(b"MZ..."), "application/octet-stream")},
            headers=admin_headers,
        )
        assert bad_res.status_code == 400
        print("[PASS] Invalid file extension rejected with 400 Bad Request.")

        # 10. Test rejection when no file is sent
        empty_res = client.post(
            f"/products/{prod_id}/thumbnail",
            headers=admin_headers,
        )
        assert empty_res.status_code == 400
        print("[PASS] Missing file upload rejected with 400 Bad Request.")

        # 11. Test authorization (non-admin should be rejected)
        unauth_res = client.post(
            f"/products/{prod_id}/thumbnail",
            files={"file": ("unauth.png", io.BytesIO(dummy_png_bytes), "image/png")},
            headers=user_headers,
        )
        assert unauth_res.status_code == 403, f"Expected 403 for non-admin, got {unauth_res.status_code}"
        print("[PASS] Non-admin upload rejected with 403 Forbidden.")

        # 12. Test standalone thumbnail upload endpoint
        standalone_res = client.post(
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
        del_thumb_res = client.delete(
            f"/products/{prod_id}/thumbnail",
            headers=admin_headers,
        )
        assert del_thumb_res.status_code == 200
        assert del_thumb_res.json()["thumbnail"] is None
        assert not new_file_on_disk.is_file(), "Thumbnail file should be deleted on DELETE"
        print("[PASS] DELETE /products/{id}/thumbnail clears column and deletes file.")

    finally:
        # Cleanup test product
        client.delete(f"/products/{prod_id}", headers=admin_headers)
        # Cleanup any remaining test files
        for f in created_files:
            if f.is_file():
                try:
                    f.unlink()
                except OSError:
                    pass
        print(f"[PASS] Cleaned up test product (id={prod_id}).")

    print("\n>>> ALL PRODUCT THUMBNAIL UPLOADFILE VERIFICATIONS PASSED 100%! <<<\n")


if __name__ == "__main__":
    test_product_thumbnail_suite()
