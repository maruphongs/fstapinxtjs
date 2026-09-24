import { API_URL, AuthUser, getToken, saveAuth } from "./auth";

export const GRAPHQL_URL = `${API_URL}/graphql`;

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query,
      variables,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`GraphQL Network error (${response.status}): ${errorText || response.statusText}`);
  }

  const result: GraphQLResponse<T> = await response.json();

  if (result.errors && result.errors.length > 0) {
    const message = result.errors.map((e) => e.message).join("; ");
    throw new Error(message || "GraphQL Execution Error");
  }

  if (!result.data) {
    throw new Error("No data returned from GraphQL server.");
  }

  return result.data;
}

// ---------------- GraphQL Types ----------------

export interface GqlCategory {
  id: number;
  name: string;
  products?: Array<{
    id: number;
    name: string;
    description?: string;
    price: number;
  }>;
}

export interface GqlProduct {
  id: number;
  name: string;
  description: string;
  price: number;
  categories: Array<{
    id: number;
    name: string;
  }>;
}

export interface GqlUser {
  id: number;
  username: string;
  role: "admin" | "user" | string;
  isActive: boolean;
}

export interface GqlAuthPayload {
  accessToken: string;
  tokenType: string;
  user: GqlUser;
}

// ---------------- Document Queries & Mutations ----------------

export const GET_PRODUCTS_QUERY = `
  query GetProducts($skip: Int, $limit: Int, $search: String, $categoryId: Int) {
    products(skip: $skip, limit: $limit, search: $search, categoryId: $categoryId) {
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
`;

export const GET_PRODUCT_QUERY = `
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
`;

export const CREATE_PRODUCT_MUTATION = `
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
`;

export const UPDATE_PRODUCT_MUTATION = `
  mutation UpdateProduct($id: Int!, $input: ProductUpdateInput!) {
    updateProduct(id: $id, input: $input) {
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
`;

export const DELETE_PRODUCT_MUTATION = `
  mutation DeleteProduct($id: Int!) {
    deleteProduct(id: $id)
  }
`;

export const ASSIGN_CATEGORY_MUTATION = `
  mutation AssignCategory($productId: Int!, $categoryId: Int!) {
    assignCategoryToProduct(productId: $productId, categoryId: $categoryId) {
      id
      name
      categories {
        id
        name
      }
    }
  }
`;

export const REMOVE_CATEGORY_MUTATION = `
  mutation RemoveCategory($productId: Int!, $categoryId: Int!) {
    removeCategoryFromProduct(productId: $productId, categoryId: $categoryId) {
      id
      name
      categories {
        id
        name
      }
    }
  }
`;

export const GET_CATEGORIES_QUERY = `
  query GetCategories($skip: Int, $limit: Int, $search: String) {
    categories(skip: $skip, limit: $limit, search: $search) {
      id
      name
      products {
        id
        name
        description
        price
      }
    }
  }
`;

export const GET_CATEGORY_QUERY = `
  query GetCategory($id: Int!) {
    category(id: $id) {
      id
      name
      products {
        id
        name
        description
        price
      }
    }
  }
`;

export const CREATE_CATEGORY_MUTATION = `
  mutation CreateCategory($input: CategoryCreateInput!) {
    createCategory(input: $input) {
      id
      name
      products {
        id
        name
      }
    }
  }
`;

export const UPDATE_CATEGORY_MUTATION = `
  mutation UpdateCategory($id: Int!, $input: CategoryUpdateInput!) {
    updateCategory(id: $id, input: $input) {
      id
      name
    }
  }
`;

export const DELETE_CATEGORY_MUTATION = `
  mutation DeleteCategory($id: Int!) {
    deleteCategory(id: $id)
  }
`;

export const GET_USERS_QUERY = `
  query GetUsers($skip: Int, $limit: Int) {
    users(skip: $skip, limit: $limit) {
      id
      username
      role
      isActive
    }
  }
`;

export const GET_USER_QUERY = `
  query GetUser($id: Int!) {
    user(id: $id) {
      id
      username
      role
      isActive
    }
  }
`;

export const ME_QUERY = `
  query Me {
    me {
      id
      username
      role
      isActive
    }
  }
`;

export const CREATE_USER_MUTATION = `
  mutation CreateUser($input: UserCreateInput!) {
    createUser(input: $input) {
      id
      username
      role
      isActive
    }
  }
`;

export const UPDATE_USER_MUTATION = `
  mutation UpdateUser($id: Int!, $input: UserUpdateInput!) {
    updateUser(id: $id, input: $input) {
      id
      username
      role
      isActive
    }
  }
`;

export const DELETE_USER_MUTATION = `
  mutation DeleteUser($id: Int!) {
    deleteUser(id: $id)
  }
`;

export const LOGIN_MUTATION = `
  mutation Login($username: String!, $password: String!) {
    login(username: $username, password: $password) {
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
`;

export const REGISTER_MUTATION = `
  mutation Register($username: String!, $password: String!) {
    register(username: $username, password: $password) {
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
`;

// ---------------- Service / Helper Functions ----------------

export async function gqlGetProducts(params?: {
  skip?: number;
  limit?: number;
  search?: string;
  categoryId?: number;
}): Promise<GqlProduct[]> {
  const data = await graphqlRequest<{ products: GqlProduct[] }>(GET_PRODUCTS_QUERY, params);
  return data.products;
}

export async function gqlGetProduct(id: number): Promise<GqlProduct | null> {
  const data = await graphqlRequest<{ product: GqlProduct | null }>(GET_PRODUCT_QUERY, { id });
  return data.product;
}

export async function gqlCreateProduct(input: {
  name: string;
  description: string;
  price: number;
  categoryIds?: number[];
}): Promise<GqlProduct> {
  const data = await graphqlRequest<{ createProduct: GqlProduct }>(CREATE_PRODUCT_MUTATION, {
    input: {
      name: input.name,
      description: input.description,
      price: input.price,
      categoryIds: input.categoryIds || [],
    },
  });
  return data.createProduct;
}

export async function gqlUpdateProduct(
  id: number,
  input: {
    name?: string;
    description?: string;
    price?: number;
    categoryIds?: number[];
  }
): Promise<GqlProduct> {
  const data = await graphqlRequest<{ updateProduct: GqlProduct }>(UPDATE_PRODUCT_MUTATION, {
    id,
    input,
  });
  return data.updateProduct;
}

export async function gqlDeleteProduct(id: number): Promise<boolean> {
  const data = await graphqlRequest<{ deleteProduct: boolean }>(DELETE_PRODUCT_MUTATION, { id });
  return data.deleteProduct;
}

export async function gqlAssignCategory(productId: number, categoryId: number): Promise<GqlProduct> {
  const data = await graphqlRequest<{ assignCategoryToProduct: GqlProduct }>(
    ASSIGN_CATEGORY_MUTATION,
    { productId, categoryId }
  );
  return data.assignCategoryToProduct;
}

export async function gqlRemoveCategory(productId: number, categoryId: number): Promise<GqlProduct> {
  const data = await graphqlRequest<{ removeCategoryFromProduct: GqlProduct }>(
    REMOVE_CATEGORY_MUTATION,
    { productId, categoryId }
  );
  return data.removeCategoryFromProduct;
}

export async function gqlGetCategories(params?: {
  skip?: number;
  limit?: number;
  search?: string;
}): Promise<GqlCategory[]> {
  const data = await graphqlRequest<{ categories: GqlCategory[] }>(GET_CATEGORIES_QUERY, params);
  return data.categories;
}

export async function gqlGetCategory(id: number): Promise<GqlCategory | null> {
  const data = await graphqlRequest<{ category: GqlCategory | null }>(GET_CATEGORY_QUERY, { id });
  return data.category;
}

export async function gqlCreateCategory(name: string): Promise<GqlCategory> {
  const data = await graphqlRequest<{ createCategory: GqlCategory }>(CREATE_CATEGORY_MUTATION, {
    input: { name },
  });
  return data.createCategory;
}

export async function gqlUpdateCategory(id: number, name: string): Promise<GqlCategory> {
  const data = await graphqlRequest<{ updateCategory: GqlCategory }>(UPDATE_CATEGORY_MUTATION, {
    id,
    input: { name },
  });
  return data.updateCategory;
}

export async function gqlDeleteCategory(id: number): Promise<boolean> {
  const data = await graphqlRequest<{ deleteCategory: boolean }>(DELETE_CATEGORY_MUTATION, { id });
  return data.deleteCategory;
}

export async function gqlGetUsers(params?: { skip?: number; limit?: number }): Promise<AuthUser[]> {
  const data = await graphqlRequest<{ users: GqlUser[] }>(GET_USERS_QUERY, params);
  return data.users.map((u) => ({
    id: u.id,
    username: u.username,
    role: u.role,
    is_active: u.isActive,
  }));
}

export async function gqlGetUser(id: number): Promise<AuthUser | null> {
  const data = await graphqlRequest<{ user: GqlUser | null }>(GET_USER_QUERY, { id });
  if (!data.user) return null;
  return {
    id: data.user.id,
    username: data.user.username,
    role: data.user.role,
    is_active: data.user.isActive,
  };
}

export async function gqlCreateUser(input: {
  username: string;
  password: string;
  role?: string;
}): Promise<AuthUser> {
  const data = await graphqlRequest<{ createUser: GqlUser }>(CREATE_USER_MUTATION, { input });
  return {
    id: data.createUser.id,
    username: data.createUser.username,
    role: data.createUser.role,
    is_active: data.createUser.isActive,
  };
}

export async function gqlUpdateUser(
  id: number,
  input: { role?: string; isActive?: boolean; password?: string }
): Promise<AuthUser> {
  const data = await graphqlRequest<{ updateUser: GqlUser }>(UPDATE_USER_MUTATION, {
    id,
    input,
  });
  return {
    id: data.updateUser.id,
    username: data.updateUser.username,
    role: data.updateUser.role,
    is_active: data.updateUser.isActive,
  };
}

export async function gqlDeleteUser(id: number): Promise<boolean> {
  const data = await graphqlRequest<{ deleteUser: boolean }>(DELETE_USER_MUTATION, { id });
  return data.deleteUser;
}

export async function gqlLogin(username: string, password: string): Promise<AuthUser> {
  const data = await graphqlRequest<{ login: GqlAuthPayload }>(LOGIN_MUTATION, {
    username,
    password,
  });
  const user: AuthUser = {
    id: data.login.user.id,
    username: data.login.user.username,
    role: data.login.user.role,
    is_active: data.login.user.isActive,
  };
  saveAuth(data.login.accessToken, user);
  return user;
}

export async function gqlRegister(username: string, password: string): Promise<AuthUser> {
  const data = await graphqlRequest<{ register: GqlAuthPayload }>(REGISTER_MUTATION, {
    username,
    password,
  });
  const user: AuthUser = {
    id: data.register.user.id,
    username: data.register.user.username,
    role: data.register.user.role,
    is_active: data.register.user.isActive,
  };
  saveAuth(data.register.accessToken, user);
  return user;
}
