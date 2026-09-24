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

Run the GraphQL automated verification suite:

```bash
uv run python test_graphql.py
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
