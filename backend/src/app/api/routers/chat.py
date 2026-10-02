import asyncio
from datetime import datetime, timezone
import json
import logging
from typing import Any
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import func, or_, select

from app.core.database import SessionLocal
from app.models.category import Category
from app.models.product import Product
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Chatbot"])


class ChatConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_json(self, websocket: WebSocket, data: dict[str, Any]):
        await websocket.send_json(data)


manager = ChatConnectionManager()

DEFAULT_SUGGESTIONS = [
    "Show products",
    "Show categories",
    "Store stats",
    "Help",
]


def get_welcome_payload() -> dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "sender": "bot",
        "type": "welcome",
        "text": (
            "👋 **Hello! I am your Store Assistant.**\n\n"
            "I can help you browse products, explore categories, or view store statistics. "
            "How can I assist you today?"
        ),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "suggestions": DEFAULT_SUGGESTIONS,
    }


def handle_chat_query(raw_query: str) -> dict[str, Any]:
    """Clean, simplified query handler for catalog assistance."""
    query = raw_query.strip().lower()
    timestamp = datetime.now(timezone.utc).isoformat()
    msg_id = str(uuid.uuid4())

    # 1. Help
    if any(query.startswith(k) for k in ["/help", "help", "commands", "/commands"]):
        return {
            "id": msg_id,
            "sender": "bot",
            "type": "help",
            "text": (
                "📖 **Available Commands & Queries:**\n\n"
                "- **`products`** or **`show all products`**: View catalog items\n"
                "- **`categories`**: Browse all product categories\n"
                "- **`stats`**: View catalog counts and metrics\n"
                "- **`/graphql`**: Learn about our GraphQL endpoint\n"
                "- **`/clear`**: Clear chat message history"
            ),
            "timestamp": timestamp,
            "suggestions": ["Show products", "Show categories", "Store stats"],
        }

    # 2. Stats
    if any(k in query for k in ["stats", "statistics", "count", "number", "metrics"]):
        with SessionLocal() as db:
            prod_count = db.scalar(select(func.count(Product.id))) or 0
            cat_count = db.scalar(select(func.count(Category.id))) or 0
            user_count = db.scalar(select(func.count(User.id))) or 0

        return {
            "id": msg_id,
            "sender": "bot",
            "type": "stats",
            "text": (
                "📊 **Store Statistics:**\n\n"
                f"- **Products:** {prod_count} items available\n"
                f"- **Categories:** {cat_count} categories configured\n"
                f"- **Registered Users:** {user_count} accounts"
            ),
            "data": {
                "productsCount": prod_count,
                "categoriesCount": cat_count,
                "usersCount": user_count,
            },
            "timestamp": timestamp,
            "suggestions": ["Show products", "Show categories"],
        }

    # 3. GraphQL info
    if "graphql" in query:
        return {
            "id": msg_id,
            "sender": "bot",
            "type": "graphql",
            "text": (
                "⚡ **GraphQL Studio is available!**\n\n"
                "Visit the dedicated **/graphql** page to test queries and mutations, or open the interactive GraphiQL explorer."
            ),
            "timestamp": timestamp,
            "suggestions": ["Show products", "Store stats"],
        }

    # 4. Products query
    if any(k in query for k in ["product", "products", "item", "items", "loot", "catalog"]):
        stop_words = {"show", "all", "list", "the", "products", "product", "items", "item", "/products", "search", "find", "me"}
        tokens = [w for w in query.split() if w not in stop_words]
        search_kw = " ".join(tokens).strip()

        with SessionLocal() as db:
            stmt = select(Product)
            if search_kw:
                stmt = stmt.where(
                    or_(
                        Product.name.ilike(f"%{search_kw}%"),
                        Product.description.ilike(f"%{search_kw}%"),
                    )
                )
            stmt = stmt.limit(10)
            products = db.scalars(stmt).all()

            if not products:
                return {
                    "id": msg_id,
                    "sender": "bot",
                    "type": "products",
                    "text": f"No products found matching '{search_kw}'. Try another search keyword.",
                    "data": {"products": []},
                    "timestamp": timestamp,
                    "suggestions": ["Show products", "Show categories"],
                }

            items = [
                {
                    "id": p.id,
                    "name": p.name,
                    "price": p.price,
                    "description": p.description,
                    "thumbnail": p.thumbnail,
                    "categories": [c.name for c in p.categories],
                }
                for p in products
            ]

            lines = [f"- **{p['name']}** - ${p['price']:.2f}" for p in items]
            text = f"Found **{len(items)}** product(s):\n\n" + "\n".join(lines)

            return {
                "id": msg_id,
                "sender": "bot",
                "type": "products",
                "text": text,
                "data": {"products": items},
                "timestamp": timestamp,
                "suggestions": ["Show categories", "Store stats"],
            }

    # 5. Categories query
    if any(k in query for k in ["categor", "bucket"]):
        with SessionLocal() as db:
            cats = db.scalars(select(Category).order_by(Category.name)).all()
            if not cats:
                return {
                    "id": msg_id,
                    "sender": "bot",
                    "type": "categories",
                    "text": "No categories have been created yet.",
                    "data": {"categories": []},
                    "timestamp": timestamp,
                    "suggestions": ["Show products"],
                }

            cat_items = [
                {"id": c.id, "name": c.name, "productCount": len(c.products)}
                for c in cats
            ]

            lines = [f"- **{c['name']}** ({c['productCount']} items)" for c in cat_items]
            text = f"We have **{len(cat_items)}** category/categories:\n\n" + "\n".join(lines)

            return {
                "id": msg_id,
                "sender": "bot",
                "type": "categories",
                "text": text,
                "data": {"categories": cat_items},
                "timestamp": timestamp,
                "suggestions": [f"Category {c['name']}" for c in cat_items[:3]] + ["Show products"],
            }

    # 6. Greetings
    if any(query.startswith(g) for g in ["hi", "hello", "hey", "greetings", "good morning", "good evening"]):
        return {
            "id": msg_id,
            "sender": "bot",
            "type": "text",
            "text": "👋 Hello! How can I help you today? You can ask me to list products, categories, or store stats.",
            "timestamp": timestamp,
            "suggestions": ["Show products", "Show categories", "Store stats"],
        }

    # 7. Fallback
    return {
        "id": msg_id,
        "sender": "bot",
        "type": "text",
        "text": f"I'm not sure how to answer '{raw_query}'. You can ask for **products**, **categories**, or **stats**, or type **help**.",
        "timestamp": timestamp,
        "suggestions": ["Show products", "Show categories", "Store stats", "Help"],
    }


@router.get("/chat/status")
def chat_status():
    """Returns status of the WebSocket chat service."""
    return {
        "status": "online",
        "bot_name": "Store Assistant",
        "active_connections": len(manager.active_connections),
    }


@router.websocket("/ws/chat")
@router.websocket("/chat/ws")
async def chat_websocket_endpoint(websocket: WebSocket):
    """Real-time WebSocket chatbot endpoint."""
    await manager.connect(websocket)
    try:
        await manager.send_json(websocket, get_welcome_payload())

        while True:
            raw_data = await websocket.receive_text()
            try:
                parsed = json.loads(raw_data)
                user_text = parsed.get("text", "") if isinstance(parsed, dict) else str(parsed)
            except json.JSONDecodeError:
                user_text = raw_data

            user_text = user_text.strip()
            if not user_text:
                continue

            # Typing indicator
            await manager.send_json(websocket, {"type": "typing", "isTyping": True})
            await asyncio.sleep(0.08)

            response = handle_chat_query(user_text)

            await manager.send_json(websocket, {"type": "typing", "isTyping": False})
            await manager.send_json(websocket, response)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        manager.disconnect(websocket)
