import asyncio
from datetime import datetime, timezone
import json
import logging
import random
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

SILLY_SUGGESTIONS = [
    "🛍️ Gib products",
    "📦 Show buckets",
    "🧠 Big brain stats",
    "💣 DO NOT CLICK",
    "🦆 Quack",
    "⚡ GraphQL magic",
]


def get_welcome_payload() -> dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "sender": "bot",
        "type": "welcome",
        "text": (
            "🤪 **HONK HONK! BEEP BOOP!** 👋\n\n"
            "I am **SillyBot**, your 1-brain-cell assistant running on pure chaos and WebSocket speed! ⚡\n\n"
            "Ask me for shiny loot, secret buckets, or click one of my silly buttons below:"
        ),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "suggestions": SILLY_SUGGESTIONS,
    }


def handle_chat_query(raw_query: str) -> dict[str, Any]:
    """Simple and silly query handler that queries the database with humorous responses."""
    query = raw_query.strip().lower()
    timestamp = datetime.now(timezone.utc).isoformat()
    msg_id = str(uuid.uuid4())

    # 1. Secret / Silly Easter Eggs
    if any(k in query for k in ["do not click", "bomb", "explode", "kaboom", "dont click"]):
        return {
            "id": msg_id,
            "sender": "bot",
            "type": "text",
            "text": (
                "💥 **KABOOOOOOOMMMMM!!!** 💥\n\n"
                "*(...Wait, nothing actually broke!)* 😅\n\n"
                "Why did you click it hooman?! Now my circuits are sweating! 👁️👄👁️"
            ),
            "timestamp": timestamp,
            "suggestions": ["🛍️ Gib products", "🦆 Quack", "🧠 Big brain stats"],
        }

    if any(k in query for k in ["quack", "duck", "rubber duck"]):
        return {
            "id": msg_id,
            "sender": "bot",
            "type": "text",
            "text": (
                "🦆 **QUACK QUACK QUACK!!** 🦆\n\n"
                "*A wild rubber duck appears! All bugs in your code are temporarily terrified and hiding.*"
            ),
            "timestamp": timestamp,
            "suggestions": ["🛍️ Gib products", "📦 Show buckets", "💣 DO NOT CLICK"],
        }

    # 2. Help
    if any(query.startswith(k) for k in ["/help", "help", "commands", "/commands", "what can you do"]):
        return {
            "id": msg_id,
            "sender": "bot",
            "type": "help",
            "text": (
                "🤖 **SillyBot 3000 User Manual:**\n\n"
                "- Say **`products`** or **`loot`**: I show you shiny things to buy!\n"
                "- Say **`categories`** or **`buckets`**: I show where things are stored!\n"
                "- Say **`stats`**: I show you big brain database numbers!\n"
                "- Say **`quack`**: For instant emotional support 🦆\n"
                "- Type **`/clear`**: If I said something weird and you want a fresh start!"
            ),
            "timestamp": timestamp,
            "suggestions": ["🛍️ Gib products", "📦 Show buckets", "🧠 Big brain stats"],
        }

    # 3. Stats / Big Brain
    if any(k in query for k in ["stats", "big brain", "statistics", "count", "number"]):
        with SessionLocal() as db:
            prod_count = db.scalar(select(func.count(Product.id))) or 0
            cat_count = db.scalar(select(func.count(Category.id))) or 0
            user_count = db.scalar(select(func.count(User.id))) or 0

        funny_remarks = [
            "🔥 Database on fire: 0% (we good!)",
            "☕ Dev coffee level: 9000% critical",
            "🐹 Hamster spinning the server wheel: Tired but running",
        ]

        return {
            "id": msg_id,
            "sender": "bot",
            "type": "stats",
            "text": (
                "🧠 **BIG BRAIN FLEX TIME!** 📊\n\n"
                f"- 📦 **{prod_count} Shiny Products** ready to be purchased\n"
                f"- 🏷️ **{cat_count} Mystery Buckets** (categories)\n"
                f"- 👤 **{user_count} Cool Humans** in the system\n"
                f"- {random.choice(funny_remarks)}\n\n"
                "Everything is vibing smoothly over WebSockets! 😎"
            ),
            "data": {
                "productsCount": prod_count,
                "categoriesCount": cat_count,
                "usersCount": user_count,
            },
            "timestamp": timestamp,
            "suggestions": ["🛍️ Gib products", "📦 Show buckets", "🦆 Quack"],
        }

    # 4. GraphQL guide
    if "graphql" in query:
        return {
            "id": msg_id,
            "sender": "bot",
            "type": "graphql",
            "text": (
                "⚡ **Oooooh, GraphQL magic!** 🧙‍♂️\n\n"
                "Head over to `/graphql` to zap the database with queries like:\n"
                "```graphql\n"
                "query {\n"
                "  products { id name price }\n"
                "}\n"
                "```\n"
                "Super fast, no carbs, 100% organic data fetching!"
            ),
            "timestamp": timestamp,
            "suggestions": ["🛍️ Gib products", "🧠 Big brain stats"],
        }

    # 5. Products / Loot Query
    if any(k in query for k in ["product", "loot", "item", "buy", "shop"]):
        # Remove common noise words to extract search keyword
        stop_words = {"show", "all", "list", "gib", "the", "products", "product", "items", "item", "/products", "search", "find", "me"}
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
                    "text": f"😭 **Oh no! No loot found for '{search_kw}'!**\nMaybe the goblins ate them? Try searching something else!",
                    "data": {"products": []},
                    "timestamp": timestamp,
                    "suggestions": ["📦 Show buckets", "🛍️ Gib products"],
                }


            items = [
                {
                    "id": p.id,
                    "name": p.name,
                    "price": p.price,
                    "description": p.description,
                    "categories": [c.name for c in p.categories],
                }
                for p in products
            ]

            return {
                "id": msg_id,
                "sender": "bot",
                "type": "products",
                "text": f"🎉 **TA-DA! Look at this fine loot! ({len(items)} items)** 🛍️\nBuy them before my creator raises the prices! 💸",
                "data": {"products": items},
                "timestamp": timestamp,
                "suggestions": ["📦 Show buckets", "🧠 Big brain stats", "🦆 Quack"],
            }

    # 6. Categories / Buckets Query
    if any(k in query for k in ["categor", "bucket"]):
        with SessionLocal() as db:
            cats = db.scalars(select(Category).order_by(Category.name)).all()
            if not cats:
                return {
                    "id": msg_id,
                    "sender": "bot",
                    "type": "categories",
                    "text": "📭 Empty buckets! No categories exist yet. Admins, feed me categories!",
                    "data": {"categories": []},
                    "timestamp": timestamp,
                    "suggestions": ["🛍️ Gib products"],
                }

            cat_items = [
                {"id": c.id, "name": c.name, "productCount": len(c.products)}
                for c in cats
            ]

            return {
                "id": msg_id,
                "sender": "bot",
                "type": "categories",
                "text": f"🗃️ **Behold! Our {len(cat_items)} magical sorting buckets!**\nClick one to peek inside:",
                "data": {"categories": cat_items},
                "timestamp": timestamp,
                "suggestions": [f"Category {c['name']}" for c in cat_items[:3]] + ["🛍️ Gib products"],
            }

    # 7. Greetings
    if any(query.startswith(g) for g in ["hi", "hello", "hey", "henlo", "yo", "sup", "greetings"]):
        return {
            "id": msg_id,
            "sender": "bot",
            "type": "text",
            "text": "👋 **HENLO HOOMAN!** 🐾\nI was just taking a digital nap. What shiny things do you seek?",
            "timestamp": timestamp,
            "suggestions": ["🛍️ Gib products", "📦 Show buckets", "🧠 Big brain stats", "💣 DO NOT CLICK"],
        }

    # 8. Who are you
    if any(k in query for k in ["who are you", "what are you", "who u", "about"]):
        return {
            "id": msg_id,
            "sender": "bot",
            "type": "text",
            "text": "🤖 I am **SillyBot 3000**! Born from FastAPI, WebSocket-powered, and 0% artificial intelligence, 100% silly vibes! 🤪",
            "timestamp": timestamp,
            "suggestions": ["🛍️ Gib products", "🦆 Quack", "🧠 Big brain stats"],
        }

    # 9. Silly Fallback
    silly_replies = [
        f"🤔 *scratches metal noggin*\n\nMy single brain cell didn't quite get *\"{raw_query}\"*, but I can fetch you shiny products or funny stats!",
        f"👀 *beep boop honk*\n\nDid you say *\"{raw_query}\"* or did a cat walk across your keyboard? Try clicking a button below!",
        f"🤪 *spinning in circles*\n\nI don't know what *\"{raw_query}\"* means, but I do know our database is full of awesome loot!",
    ]
    return {
        "id": msg_id,
        "sender": "bot",
        "type": "text",
        "text": random.choice(silly_replies),
        "timestamp": timestamp,
        "suggestions": ["🛍️ Gib products", "📦 Show buckets", "🧠 Big brain stats", "🦆 Quack"],
    }


@router.get("/chat/status")
def chat_status():
    """Returns status of the silly WebSocket chat service."""
    return {
        "status": "online",
        "bot_name": "SillyBot 3000",
        "active_connections": len(manager.active_connections),
        "mood": "very silly 🤪",
    }


@router.websocket("/ws/chat")
@router.websocket("/chat/ws")
async def chat_websocket_endpoint(websocket: WebSocket):
    """Silly real-time WebSocket chatbot endpoint."""
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

            # Quick typing bounce
            await manager.send_json(websocket, {"type": "typing", "isTyping": True})
            await asyncio.sleep(0.12)

            response = handle_chat_query(user_text)

            await manager.send_json(websocket, {"type": "typing", "isTyping": False})
            await manager.send_json(websocket, response)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        manager.disconnect(websocket)
