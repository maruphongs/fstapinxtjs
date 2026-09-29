import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from starlette.testclient import TestClient
from app.main import app


client = TestClient(app)

def test_chat_websocket_suite():
    print("Starting WebSocket Chatbot verification...")

    # Test HTTP status endpoint
    status_res = client.get("/chat/status")
    assert status_res.status_code == 200, f"Status failed: {status_res.text}"
    status_data = status_res.json()
    assert status_data["status"] == "online"
    print("[PASS] Chat status endpoint verified.")

    # Test WebSocket connection and welcome message
    with client.websocket_connect("/ws/chat") as websocket:
        welcome = websocket.receive_json()
        assert welcome["sender"] == "bot", "Welcome message missing bot sender"
        assert welcome["type"] == "welcome"
        assert len(welcome["suggestions"]) > 0
        print("[PASS] WebSocket welcome greeting received:", welcome["text"][:40])

        # Test help command
        websocket.send_text("/help")
        # Typing indicator on
        typing_on = websocket.receive_json()
        assert typing_on.get("type") == "typing" and typing_on.get("isTyping") is True
        # Typing indicator off
        typing_off = websocket.receive_json()
        assert typing_off.get("type") == "typing" and typing_off.get("isTyping") is False
        # Response message
        reply = websocket.receive_json()
        assert reply["sender"] == "bot"
        assert reply["type"] == "help"
        print("[PASS] /help command reply received successfully.")

        # Test stats query
        websocket.send_text("/stats")
        websocket.receive_json() # typing on
        websocket.receive_json() # typing off
        stats_reply = websocket.receive_json()
        assert stats_reply["type"] == "stats"
        assert "productsCount" in stats_reply["data"]
        print("[PASS] /stats query received with DB counts:", stats_reply["data"])

        # Test products query
        websocket.send_text("show all products")
        websocket.receive_json() # typing on
        websocket.receive_json() # typing off
        products_reply = websocket.receive_json()
        assert products_reply["type"] == "products"
        assert "products" in products_reply["data"]
        print(f"[PASS] Products query returned {len(products_reply['data']['products'])} product(s).")

        # Test categories query
        websocket.send_text("/categories")
        websocket.receive_json() # typing on
        websocket.receive_json() # typing off
        cat_reply = websocket.receive_json()
        assert cat_reply["type"] == "categories"
        assert "categories" in cat_reply["data"]
        print(f"[PASS] Categories query returned {len(cat_reply['data']['categories'])} category(s).")

        # Test GraphQL query
        websocket.send_text("/graphql")
        websocket.receive_json() # typing on
        websocket.receive_json() # typing off
        gql_reply = websocket.receive_json()
        assert gql_reply["type"] == "graphql"
        print("[PASS] GraphQL guide reply received.")

        # Test JSON format payload
        websocket.send_json({"text": "Hello there!"})
        websocket.receive_json() # typing on
        websocket.receive_json() # typing off
        hello_reply = websocket.receive_json()
        assert hello_reply["sender"] == "bot"
        print("[PASS] Conversational greeting reply received.")

    print("\n>>> ALL WEBSOCKET CHATBOT TESTS PASSED 100%! <<<\n")

if __name__ == "__main__":
    test_chat_websocket_suite()
