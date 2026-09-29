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

router = APIRouter(
    tags=["Chatbot"],
)


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


def get_welcome_payload() -> dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "sender": "bot",
        "type": "welcome",
        "text": (
            "👋 **Welcome to the UniWeb Assistant!**\n\n"
            "I'm your real-time assistant connected via WebSocket. You can ask me to search products, "
            "browse categories, get database stats, or learn how to use the GraphQL API."
        ),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "suggestions": [
            "📦 Show all products",
            "🏷️ List categories",
            "📊 System stats",
            "⚡ GraphQL guide",
            "❓ Help & commands",
        ],
    }


def handle_chat_query(raw_query: str) -> dict[str, Any]:
    """Processes user query and queries the database to return assistant answers."""
    query = raw_query.strip().lower()
    timestamp = datetime.now(timezone.utc).isoformat()
    msg_id = str(uuid.uuid4())

    # 1. Help & commands
    if query in ["/help", "help", "commands", "/commands", "what can you do"]:
        return {
            "id": msg_id,
            "sender": "bot",
            "type": "help",
            "text": (
                "### 🤖 UniWeb Assistant Commands\n\n"
                "Here are some things you can ask me:\n"
                "- **`/products`** or **`search <term>`**: Find products in the catalog.\n"
                "- **`/categories`**: Browse all available product categories.\n"
                "- **`category <name>`**: View products in a specific category.\n"
                "- **`/stats`**: View total counts for products, categories, and registered users.\n"
                "- **`/graphql`**: Learn how to execute GraphQL queries and mutations.\n"
                "- **`/clear`**: Clear current chat history in the widget.\n"
                "- **`who are you`**: About this assistant."
            ),
            "timestamp": timestamp,
            "suggestions": ["📦 Show all products", "🏷️ List categories", "📊 System stats"],
        }

    # 2. Stats
    if query in ["/stats", "stats", "system stats", "statistics", "count"]:
        with SessionLocal() as db:
            prod_count = db.scalar(select(func.count(Product.id))) or 0
            cat_count = db.scalar(select(func.count(Category.id))) or 0
            user_count = db.scalar(select(func.count(User.id))) or 0

        return {
            "id": msg_id,
            "sender": "bot",
            "type": "stats",
            "text": (
                f"### 📊 System Overview\n\n"
                f"- **Products in catalog**: {prod_count}\n"
                f"- **Categories**: {cat_count}\n"
                f"- **Registered Users**: {user_count}\n"
                f"- **Protocol**: WebSocket (FastAPI backend + Next.js client)\n"
                f"- **Status**: All systems operational 🚀"
            ),
            "data": {
                "productsCount": prod_count,
                "categoriesCount": cat_count,
                "usersCount": user_count,
            },
            "timestamp": timestamp,
            "suggestions": ["📦 Show all products", "🏷️ List categories"],
        }

    # 3. GraphQL guide
    if query in ["/graphql", "graphql", "how to use graphql", "graphql api"]:
        return {
            "id": msg_id,
            "sender": "bot",
            "type": "graphql",
            "text": (
                "### ⚡ GraphQL CRUD Studio\n\n"
                "You can query or mutate products, categories, and users at `/graphql`!\n\n"
                "**Sample Query:**\n"
                "```graphql\n"
                "query GetProducts {\n"
                "  products {\n"
                "    id\n"
                "    name\n"
                "    price\n"
                "    categories { id name }\n"
                "  }\n"
                "}\n"
                "```\n\n"
                "Visit the **GraphQL** tab in the navbar to test live queries in the interactive studio."
            ),
            "timestamp": timestamp,
            "suggestions": ["📦 Show all products", "📊 System stats"],
        }

    # 4. Products query / search
    if (
        query.startswith("/products")
        or query.startswith("products")
        or query.startswith("search ")
        or query.startswith("find ")
        or "show all products" in query
        or "list products" in query
        or "what products" in query
    ):
        # Extract search keyword if any
        search_term = ""
        if query.startswith("/products"):
            search_term = query[len("/products") :].strip()
        elif query.startswith("products"):
            search_term = query[len("products") :].strip()
        elif query.startswith("search "):
            search_term = query[len("search ") :].strip()
        elif query.startswith("find "):
            search_term = query[len("find ") :].strip()

        with SessionLocal() as db:
            stmt = select(Product)
            if search_term and search_term not in ["all", "list", "show"]:
                stmt = stmt.where(
                    or_(
                        Product.name.ilike(f"%{search_term}%"),
                        Product.description.ilike(f"%{search_term}%"),
                    )
                )
            stmt = stmt.limit(20)
            products = db.scalars(stmt).all()

            if not products:
                msg = f"No products found matching **'{search_term}'**." if search_term else "There are currently no products in the catalog."
                return {
                    "id": msg_id,
                    "sender": "bot",
                    "type": "products",
                    "text": f"{msg}\n\nTry another keyword or view all categories.",
                    "data": {"products": []},
                    "timestamp": timestamp,
                    "suggestions": ["🏷️ List categories", "📦 Show all products"],
                }

            items_data = []
            for p in products:
                cat_names = [c.name for c in p.categories]
                items_data.append({
                    "id": p.id,
                    "name": p.name,
                    "price": p.price,
                    "description": p.description,
                    "categories": cat_names,
                })

            header_text = f"Found {len(items_data)} matching product(s):" if search_term else f"Here are {len(items_data)} products in the store:"
            return {
                "id": msg_id,
                "sender": "bot",
                "type": "products",
                "text": f"### 📦 {header_text}\n\nClick any item or browse the `/products` page for full management.",
                "data": {"products": items_data},
                "timestamp": timestamp,
                "suggestions": ["🏷️ List categories", "📊 System stats"],
            }

    # 5. Specific Category filter
    if query.startswith("category ") or query.startswith("/category ") or "in category" in query:
        cat_search = ""
        if query.startswith("/category "):
            cat_search = query[len("/category ") :].strip()
        elif query.startswith("category "):
            cat_search = query[len("category ") :].strip()
        elif "in category" in query:
            cat_search = query.split("in category")[-1].strip()

        with SessionLocal() as db:
            stmt = select(Category).where(Category.name.ilike(f"%{cat_search}%"))
            cat = db.scalars(stmt).first()

            if not cat:
                return {
                    "id": msg_id,
                    "sender": "bot",
                    "type": "text",
                    "text": f"Category matching **'{cat_search}'** not found. Type `/categories` to see all available categories.",
                    "timestamp": timestamp,
                    "suggestions": ["🏷️ List categories", "📦 Show all products"],
                }

            items_data = []
            for p in cat.products:
                items_data.append({
                    "id": p.id,
                    "name": p.name,
                    "price": p.price,
                    "description": p.description,
                    "categories": [c.name for c in p.categories],
                })

            return {
                "id": msg_id,
                "sender": "bot",
                "type": "products",
                "text": f"### 🏷️ Category: **{cat.name}**\n\nFound {len(items_data)} product(s) in this category:",
                "data": {"products": items_data, "category": cat.name},
                "timestamp": timestamp,
                "suggestions": ["🏷️ Other categories", "📊 System stats"],
            }

    # 6. Categories query
    if (
        query in ["/categories", "categories", "list categories", "show categories"]
        or "categories" in query
        or "list category" in query
    ):
        with SessionLocal() as db:
            categories = db.scalars(select(Category).order_by(Category.name)).all()

            if not categories:
                return {
                    "id": msg_id,
                    "sender": "bot",
                    "type": "categories",
                    "text": "There are currently no categories created. Admins can create new categories in the `/categories` page.",
                    "data": {"categories": []},
                    "timestamp": timestamp,
                    "suggestions": ["📦 Show all products", "📊 System stats"],
                }

            cats_data = [
                {"id": c.id, "name": c.name, "productCount": len(c.products)}
                for c in categories
            ]

            return {
                "id": msg_id,
                "sender": "bot",
                "type": "categories",
                "text": f"### 🏷️ Product Categories ({len(cats_data)})\n\nClick on any category to view its associated products:",
                "data": {"categories": cats_data},
                "timestamp": timestamp,
                "suggestions": [f"Category {c['name']}" for c in cats_data[:3]] + ["📦 Show all products"],
            }

    # 7. Greetings
    if any(query.startswith(g) for g in ["hi", "hello", "hey", "good morning", "good afternoon", "greetings", "yo"]):
        return {
            "id": msg_id,
            "sender": "bot",
            "type": "text",
            "text": (
                "👋 Hello! I'm here to assist you with the product catalog, categories, and system features. "
                "What would you like to explore today?"
            ),
            "timestamp": timestamp,
            "suggestions": ["📦 Show all products", "🏷️ List categories", "📊 System stats", "⚡ GraphQL guide"],
        }

    # 8. About / Identity
    if "who are you" in query or "what are you" in query or "about" in query:
        return {
            "id": msg_id,
            "sender": "bot",
            "type": "text",
            "text": (
                "🤖 I'm the **UniWeb Assistant**, built with FastAPI WebSocket in Python and React on the frontend. "
                "I provide instant real-time answers about your store catalog, categories, and developer tools."
            ),
            "timestamp": timestamp,
            "suggestions": ["📦 Show all products", "📊 System stats", "❓ Help & commands"],
        }

    # 9. Fallback general response
    return {
        "id": msg_id,
        "sender": "bot",
        "type": "text",
        "text": (
            f"I received: *\"{raw_query}\"*\n\n"
            "I can help you search products, list categories, check system stats, or explain GraphQL! "
            "Try asking **\"Show all products\"**, **\"List categories\"**, or type **`/help`** for commands."
        ),
        "timestamp": timestamp,
        "suggestions": ["📦 Show all products", "🏷️ List categories", "📊 System stats", "❓ Help & commands"],
    }


@router.get("/chat/status")
def chat_status():
    """Returns the current status of the WebSocket chat service."""
    return {
        "status": "online",
        "active_connections": len(manager.active_connections),
        "protocol": "websocket",
        "endpoints": ["/ws/chat", "/chat/ws"],
    }


@router.websocket("/ws/chat")
@router.websocket("/chat/ws")
async def chat_websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for bidirectional real-time chatbot communication.
    Supports greeting on connect, typing indicators, structured product/category replies,
    and graceful error/disconnect recovery.
    """
    await manager.connect(websocket)
    try:
        # Send initial welcome greeting
        await manager.send_json(websocket, get_welcome_payload())

        while True:
            # Receive text or JSON message from client
            raw_data = await websocket.receive_text()
            user_text = ""

            try:
                parsed = json.loads(raw_data)
                if isinstance(parsed, dict):
                    user_text = parsed.get("text", "")
                else:
                    user_text = str(parsed)
            except json.JSONDecodeError:
                user_text = raw_data

            user_text = user_text.strip()
            if not user_text:
                continue

            # Echo typing state
            await manager.send_json(websocket, {
                "type": "typing",
                "isTyping": True,
            })

            # Small async yield to feel natural and prevent CPU hogging
            await asyncio.sleep(0.15)

            # Process query
            response = handle_chat_query(user_text)

            # Send typing off
            await manager.send_json(websocket, {
                "type": "typing",
                "isTyping": False,
            })

            # Send assistant reply
            await manager.send_json(websocket, response)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("WebSocket chat client disconnected normally.")
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        manager.disconnect(websocket)
