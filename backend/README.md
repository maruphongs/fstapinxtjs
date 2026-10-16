# FastAPI Backend with GraphQL (Strawberry) & REST

This backend is built with **FastAPI**, **SQLAlchemy** (SQLite), and **Strawberry GraphQL**. It supports full CRUD operations over both REST and GraphQL protocols, with JWT authentication and role-based access control.

---

## 🚀 Features

- **GraphQL Engine**: Powered by [Strawberry GraphQL](https://strawberry.rocks/) with built-in GraphiQL IDE.
- **Full CRUD Support**: Complete queries and mutations for Products, Categories, and Users.
- **Relational Integrity**: Nested relationships (`Product` ↔ `Category` many-to-many associations).
- **JWT Authentication**: Secure Bearer token authentication in GraphQL context and REST endpoints.
- **Role-Based Access Control**:
  - Public: Querying products, categories, login, registration.
  - Active Users: Querying users, current user (`me`).
  - Admins: Creating, updating, and deleting products, categories, and users.
- **Automated Verification**: Integrated test suite covering all GraphQL CRUD mutations and queries.

---

## 🛠️ Getting Started

### 1. Installation

Install dependencies using `uv`:

```bash
uv sync
```

### 2. Run the Development Server

```bash
uv run fastapi dev src/app/main.py
```

- API Base URL: `http://127.0.0.1:8000`
- Interactive GraphiQL IDE: `http://127.0.0.1:8000/graphql`
- OpenAPI Swagger Docs: `http://127.0.0.1:8000/docs`

---

## 🧪 Running Automated Tests

Run the test verification suites:

```bash
# Product project verification (access connections, unauthorized access, thumbnail removal)
uv run python tests/test_products.py

# Product thumbnail and upload verification
uv run python tests/test_product_thumbnail.py

# Redis-backed login rate limit verification (max 5 logins/minute)
uv run python tests/test_login_rate_limit.py

# GraphQL automated verification suite
uv run python tests/test_graphql.py

# WebSocket chatbot verification
uv run python tests/test_chat_ws.py
```


---

## 📖 GraphQL API Reference (`/graphql`)

### 1. Queries

```graphql
# Retrieve all products with categories
query {
  products(skip: 0, limit: 100, search: "device", categoryId: 1) {
    id
    name
    description
    price
    categories {
      id
      name
    }
  }
}

# Retrieve a single product by ID
query {
  product(id: 1) {
    id
    name
    price
    categories {
      id
      name
    }
  }
}

# Retrieve all categories with products
query {
  categories(skip: 0, limit: 100, search: "electronics") {
    id
    name
    products {
      id
      name
      price
    }
  }
}

# Retrieve authenticated user info
query {
  me {
    id
    username
    role
    isActive
  }
}

# Retrieve all users (Requires auth)
query {
  users(skip: 0, limit: 100) {
    id
    username
    role
    isActive
  }
}
```

### 2. Mutations

```graphql
# User Login
mutation {
  login(username: "admin", password: "1234") {
    accessToken
    tokenType
    user {
      id
      username
      role
    }
  }
}

# Create Category (Admin)
mutation {
  createCategory(input: { name: "Electronics" }) {
    id
    name
  }
}

# Update Category (Admin)
mutation {
  updateCategory(id: 1, input: { name: "Updated Electronics" }) {
    id
    name
  }
}

# Delete Category (Admin)
mutation {
  deleteCategory(id: 1)
}

# Create Product (Admin)
mutation {
  createProduct(
    input: {
      name: "Wireless Mouse"
      description: "Ergonomic 2.4GHz mouse"
      price: 29.99
      categoryIds: [1]
    }
  ) {
    id
    name
    price
    categories {
      id
      name
    }
  }
}

# Update Product (Admin)
mutation {
  updateProduct(
    id: 1
    input: {
      name: "Wireless Mouse Pro"
      price: 39.99
    }
  ) {
    id
    name
    price
  }
}

# Delete Product (Admin)
mutation {
  deleteProduct(id: 1)
}

# Assign / Remove Category from Product (Admin)
mutation {
  assignCategoryToProduct(productId: 1, categoryId: 2) {
    id
    name
  }
}

mutation {
  removeCategoryFromProduct(productId: 1, categoryId: 2) {
    id
    name
  }
}

# Create User (Admin)
mutation {
  createUser(input: { username: "jane_doe", password: "password123", role: "user" }) {
    id
    username
    role
  }
}

# Update User (Admin)
mutation {
  updateUser(id: 2, input: { role: "admin", isActive: true }) {
    id
    username
    role
    isActive
  }
}

# Delete User (Admin)
mutation {
  deleteUser(id: 2)
}
```

---

## 🛡️ Redis-Backed Login Rate Limiting

The application enforces a rate limit on login attempts: **maximum 5 login attempts per minute (60 seconds)**. State is maintained in Redis storage.

### 1. Redis Service Setup
Start Redis via Docker or Docker Compose from the project root:
```bash
docker compose up -d
# Or standalone docker command:
docker run -d --name uniweb-redis -p 6379:6379 --restart unless-stopped redis:alpine
```

### 2. Configuration (`app/core/config.py`)
- `REDIS_URL`: `redis://localhost:6379/0`
- `LOGIN_RATE_LIMIT_MAX_ATTEMPTS`: `5`
- `LOGIN_RATE_LIMIT_WINDOW_SECONDS`: `60`

### 3. Redis Storage Structure
- **Key Pattern**: `ratelimit:login:{client_ip}` (e.g., `ratelimit:login:127.0.0.1`)
- **Value**: Atomic integer counter incremented per login attempt (`INCR`)
- **TTL**: Remaining seconds in the 60-second window (`EXPIRE`)

### 4. Rate Limiting Behavior
- Requests 1 to 5 within a 60-second window are processed normally.
- Request 6 and above are rejected immediately with **HTTP 429 Too Many Requests**:
```json
{
  "detail": "Too many login attempts. Limit is 5 attempts per 60 seconds. Please try again in 59 seconds."
}
```
- **Response Headers**:
  - `Retry-After`: Remaining seconds until reset
  - `X-RateLimit-Limit`: `5`
  - `X-RateLimit-Remaining`: `0`
  - `X-RateLimit-Reset`: Remaining seconds

