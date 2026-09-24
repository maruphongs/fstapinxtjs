"""
Comprehensive automated tests for GraphQL queries and mutations.
"""
from starlette.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_graphql_suite():
    # 1. Login via GraphQL mutation
    login_mut = """
    mutation Login($u: String!, $p: String!) {
      login(username: $u, password: $p) {
        accessToken
        tokenType
        user {
          id
          username
          role
          isActive
        }
      }
    }
    """
    res = client.post("/graphql", json={"query": login_mut, "variables": {"u": "admin", "p": "1234"}})
    assert res.status_code == 200, res.text
    data = res.json()
    assert "errors" not in data, f"Login errors: {data.get('errors')}"
    token = data["data"]["login"]["accessToken"]
    assert token is not None
    print("[PASS] GraphQL Login mutation succeeded.")

    headers = {"Authorization": f"Bearer {token}"}

    # 2. Query Me
    me_query = "query { me { id username role isActive } }"
    res = client.post("/graphql", json={"query": me_query}, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "errors" not in data, data.get("errors")
    assert data["data"]["me"]["username"] == "admin"
    print("[PASS] GraphQL Me query succeeded.")

    # 3. Query Users
    users_query = "query { users { id username role } }"
    res = client.post("/graphql", json={"query": users_query}, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "errors" not in data, data.get("errors")
    assert len(data["data"]["users"]) > 0
    print(f"[PASS] GraphQL Users query succeeded ({len(data['data']['users'])} users).")

    # 4. Create Category via GraphQL
    create_cat_mut = """
    mutation CreateCat($name: String!) {
      createCategory(input: { name: $name }) {
        id
        name
        products { id name }
      }
    }
    """
    res = client.post("/graphql", json={"query": create_cat_mut, "variables": {"name": "GQL Tech Category"}}, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "errors" not in data, data.get("errors")
    cat_id = data["data"]["createCategory"]["id"]
    print(f"[PASS] GraphQL CreateCategory mutation succeeded (id={cat_id}).")

    # 5. Update Category via GraphQL
    update_cat_mut = """
    mutation UpdateCat($id: Int!, $name: String!) {
      updateCategory(id: $id, input: { name: $name }) {
        id
        name
      }
    }
    """
    res = client.post("/graphql", json={"query": update_cat_mut, "variables": {"id": cat_id, "name": "GQL Tech Category Updated"}}, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "errors" not in data, data.get("errors")
    assert data["data"]["updateCategory"]["name"] == "GQL Tech Category Updated"
    print("[PASS] GraphQL UpdateCategory mutation succeeded.")

    # 6. Create Product via GraphQL
    create_prod_mut = """
    mutation CreateProduct($input: ProductCreateInput!) {
      createProduct(input: $input) {
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
    """
    prod_payload = {
      "input": {
        "name": "GraphQL Smart Device",
        "description": "High-tech test gadget",
        "price": 299.99,
        "categoryIds": [cat_id]
      }
    }
    res = client.post("/graphql", json={"query": create_prod_mut, "variables": prod_payload}, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "errors" not in data, data.get("errors")
    prod = data["data"]["createProduct"]
    prod_id = prod["id"]
    assert prod["name"] == "GraphQL Smart Device"
    assert len(prod["categories"]) == 1
    assert prod["categories"][0]["id"] == cat_id
    print(f"[PASS] GraphQL CreateProduct mutation succeeded (id={prod_id}).")

    # 7. Query Product with Categories
    prod_query = """
    query GetProduct($id: Int!) {
      product(id: $id) {
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
    """
    res = client.post("/graphql", json={"query": prod_query, "variables": {"id": prod_id}})
    assert res.status_code == 200
    data = res.json()
    assert "errors" not in data, data.get("errors")
    assert data["data"]["product"]["id"] == prod_id
    print("[PASS] GraphQL GetProduct query succeeded.")

    # 8. Update Product via GraphQL
    update_prod_mut = """
    mutation UpdateProduct($id: Int!, $input: ProductUpdateInput!) {
      updateProduct(id: $id, input: $input) {
        id
        name
        price
      }
    }
    """
    res = client.post("/graphql", json={
      "query": update_prod_mut,
      "variables": {
        "id": prod_id,
        "input": {"name": "GraphQL Smart Device v2", "price": 349.99}
      }
    }, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "errors" not in data, data.get("errors")
    assert data["data"]["updateProduct"]["name"] == "GraphQL Smart Device v2"
    assert data["data"]["updateProduct"]["price"] == 349.99
    print("[PASS] GraphQL UpdateProduct mutation succeeded.")

    # 9. Delete Product via GraphQL
    del_prod_mut = "mutation Del($id: Int!) { deleteProduct(id: $id) }"
    res = client.post("/graphql", json={"query": del_prod_mut, "variables": {"id": prod_id}}, headers=headers)
    assert res.status_code == 200
    assert res.json()["data"]["deleteProduct"] is True
    print("[PASS] GraphQL DeleteProduct mutation succeeded.")

    # 10. Delete Category via GraphQL
    del_cat_mut = "mutation DelCat($id: Int!) { deleteCategory(id: $id) }"
    res = client.post("/graphql", json={"query": del_cat_mut, "variables": {"id": cat_id}}, headers=headers)
    assert res.status_code == 200
    assert res.json()["data"]["deleteCategory"] is True
    print("[PASS] GraphQL DeleteCategory mutation succeeded.")

    # 11. User CRUD via GraphQL
    create_user_mut = """
    mutation CreateUser($input: UserCreateInput!) {
      createUser(input: $input) {
        id
        username
        role
        isActive
      }
    }
    """
    res = client.post("/graphql", json={
      "query": create_user_mut,
      "variables": {
        "input": {"username": "graphql_test_user", "password": "password123", "role": "user"}
      }
    }, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "errors" not in data, data.get("errors")
    test_user_id = data["data"]["createUser"]["id"]
    print(f"[PASS] GraphQL CreateUser mutation succeeded (id={test_user_id}).")

    # Update User via GraphQL
    update_user_mut = """
    mutation UpdateUser($id: Int!, $input: UserUpdateInput!) {
      updateUser(id: $id, input: $input) {
        id
        username
        role
        isActive
      }
    }
    """
    res = client.post("/graphql", json={
      "query": update_user_mut,
      "variables": {
        "id": test_user_id,
        "input": {"role": "admin", "isActive": False}
      }
    }, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "errors" not in data, data.get("errors")
    assert data["data"]["updateUser"]["role"] == "admin"
    assert data["data"]["updateUser"]["isActive"] is False
    print("[PASS] GraphQL UpdateUser mutation succeeded.")

    # Delete User via GraphQL
    del_user_mut = "mutation DelUser($id: Int!) { deleteUser(id: $id) }"
    res = client.post("/graphql", json={"query": del_user_mut, "variables": {"id": test_user_id}}, headers=headers)
    assert res.status_code == 200
    assert res.json()["data"]["deleteUser"] is True
    print("[PASS] GraphQL DeleteUser mutation succeeded.")

    print("\n>>> ALL 12 GRAPHQL CRUD VERIFICATIONS PASSED 100%! <<<")

if __name__ == "__main__":
    test_graphql_suite()
