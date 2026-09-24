"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthUser, getUser } from "../lib/auth";
import {
  GRAPHQL_URL,
  GqlCategory,
  GqlProduct,
  gqlAssignCategory,
  gqlCreateCategory,
  gqlCreateProduct,
  gqlCreateUser,
  gqlDeleteCategory,
  gqlDeleteProduct,
  gqlDeleteUser,
  gqlGetCategories,
  gqlGetProducts,
  gqlGetUsers,
  gqlRemoveCategory,
  gqlUpdateCategory,
  gqlUpdateProduct,
  gqlUpdateUser,
  graphqlRequest,
} from "../lib/graphql";

type ActiveTab = "products" | "categories" | "users" | "explorer";

interface LastOperation {
  name: string;
  type: "query" | "mutation";
  query: string;
  variables?: Record<string, unknown>;
  response: unknown;
  timestamp: string;
  durationMs: number;
}

const PRESET_QUERIES: Record<
  string,
  { query: string; variables: Record<string, unknown> }
> = {
  "1. Fetch All Products with Categories": {
    query: `query GetAllProducts {
  products(limit: 50) {
    id
    name
    description
    price
    categories {
      id
      name
    }
  }
}`,
    variables: {},
  },
  "2. Fetch Categories with Nested Products": {
    query: `query GetCategoriesWithProducts {
  categories {
    id
    name
    products {
      id
      name
      price
    }
  }
}`,
    variables: {},
  },
  "3. Current Authenticated User (me)": {
    query: `query GetCurrentUser {
  me {
    id
    username
    role
    isActive
  }
}`,
    variables: {},
  },
  "4. List Registered Users": {
    query: `query GetAllUsers {
  users(limit: 50) {
    id
    username
    role
    isActive
  }
}`,
    variables: {},
  },
  "5. Create Category Mutation": {
    query: `mutation CreateNewCategory($input: CategoryCreateInput!) {
  createCategory(input: $input) {
    id
    name
  }
}`,
    variables: {
      input: {
        name: "New Gadgets",
      },
    },
  },
  "6. Create Product Mutation": {
    query: `mutation CreateNewProduct($input: ProductCreateInput!) {
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
}`,
    variables: {
      input: {
        name: "Mechanical Keyboard",
        description: "Custom mechanical keyboard with RGB",
        price: 89.99,
        categoryIds: [],
      },
    },
  },
  "7. User Authentication Login Mutation": {
    query: `mutation Authenticate($username: String!, $password: String!) {
  login(username: $username, password: $password) {
    accessToken
    tokenType
    user {
      id
      username
      role
    }
  }
}`,
    variables: {
      username: "admin",
      password: "1234",
    },
  },
};

export default function GraphQLPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("products");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [lastOp, setLastOp] = useState<LastOperation | null>(null);

  // Products State
  const [products, setProducts] = useState<GqlProduct[]>([]);
  const [categories, setCategories] = useState<GqlCategory[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedCatFilter, setSelectedCatFilter] = useState<number | "all">("all");
  const [productsLoading, setProductsLoading] = useState(false);

  // Product Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [productName, setProductName] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productCategoryIds, setProductCategoryIds] = useState<number[]>([]);
  const [productSubmitting, setProductSubmitting] = useState(false);

  // Category Modals
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categorySubmitting, setCategorySubmitting] = useState(false);

  // Users State
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"user" | "admin">("user");
  const [userSubmitting, setUserSubmitting] = useState(false);

  // Explorer State
  const [selectedPreset, setSelectedPreset] = useState("1. Fetch All Products with Categories");
  const [customQuery, setCustomQuery] = useState(PRESET_QUERIES["1. Fetch All Products with Categories"].query);
  const [customVariables, setCustomVariables] = useState(
    JSON.stringify(PRESET_QUERIES["1. Fetch All Products with Categories"].variables, null, 2)
  );
  const [explorerResult, setExplorerResult] = useState<string>("// Run a query to see the live GraphQL response");
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [explorerTiming, setExplorerTiming] = useState<number | null>(null);
  const [explorerStatus, setExplorerStatus] = useState<"idle" | "success" | "error">("idle");

  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    setCurrentUser(getUser());
    const handleAuthChange = () => setCurrentUser(getUser());
    window.addEventListener("auth-changed", handleAuthChange);
    return () => window.removeEventListener("auth-changed", handleAuthChange);
  }, []);

  function notify(type: "success" | "error", message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  }

  // ---------------- Load Data via GraphQL ----------------

  async function loadProductsData() {
    setProductsLoading(true);
    const start = performance.now();
    try {
      const catId = selectedCatFilter === "all" ? undefined : selectedCatFilter;
      const data = await gqlGetProducts({
        search: productSearch.trim() || undefined,
        categoryId: catId,
      });
      setProducts(data);
      const cats = await gqlGetCategories();
      setCategories(cats);
      const duration = Math.round(performance.now() - start);
      setLastOp({
        name: "GetProducts",
        type: "query",
        query: `query GetProducts($search: String, $categoryId: Int) { ... }`,
        variables: { search: productSearch.trim() || null, categoryId: catId || null },
        response: { count: data.length, sample: data[0] },
        timestamp: new Date().toLocaleTimeString(),
        durationMs: duration,
      });
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Failed to load products via GraphQL");
    } finally {
      setProductsLoading(false);
    }
  }

  async function loadCategoriesData() {
    setCategoriesLoading(true);
    const start = performance.now();
    try {
      const data = await gqlGetCategories();
      setCategories(data);
      const duration = Math.round(performance.now() - start);
      setLastOp({
        name: "GetCategories",
        type: "query",
        query: `query GetCategories { categories { id name products { id name price } } }`,
        response: { count: data.length, sample: data[0] },
        timestamp: new Date().toLocaleTimeString(),
        durationMs: duration,
      });
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Failed to load categories via GraphQL");
    } finally {
      setCategoriesLoading(false);
    }
  }

  async function loadUsersData() {
    setUsersLoading(true);
    const start = performance.now();
    try {
      const data = await gqlGetUsers();
      setUsers(data);
      const duration = Math.round(performance.now() - start);
      setLastOp({
        name: "GetUsers",
        type: "query",
        query: `query GetUsers { users { id username role isActive } }`,
        response: { count: data.length, sample: data[0] },
        timestamp: new Date().toLocaleTimeString(),
        durationMs: duration,
      });
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Failed to load users via GraphQL (Admin or Login required)");
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "products") {
      void loadProductsData();
    } else if (activeTab === "categories") {
      void loadCategoriesData();
    } else if (activeTab === "users") {
      void loadUsersData();
    }
  }, [activeTab, selectedCatFilter]);

  // ---------------- Product Handlers ----------------

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    setProductSubmitting(true);
    const start = performance.now();
    try {
      const priceNum = parseFloat(productPrice);
      if (isNaN(priceNum)) throw new Error("Price must be a valid number");

      if (editingProductId) {
        const updated = await gqlUpdateProduct(editingProductId, {
          name: productName.trim(),
          description: productDesc.trim(),
          price: priceNum,
          categoryIds: productCategoryIds,
        });
        setLastOp({
          name: "UpdateProduct",
          type: "mutation",
          query: `mutation UpdateProduct($id: Int!, $input: ProductUpdateInput!) { ... }`,
          variables: { id: editingProductId, input: { name: productName, price: priceNum } },
          response: updated,
          timestamp: new Date().toLocaleTimeString(),
          durationMs: Math.round(performance.now() - start),
        });
        notify("success", `Product #${editingProductId} updated via GraphQL!`);
      } else {
        const created = await gqlCreateProduct({
          name: productName.trim(),
          description: productDesc.trim(),
          price: priceNum,
          categoryIds: productCategoryIds,
        });
        setLastOp({
          name: "CreateProduct",
          type: "mutation",
          query: `mutation CreateProduct($input: ProductCreateInput!) { ... }`,
          variables: { input: { name: productName, price: priceNum, categoryIds: productCategoryIds } },
          response: created,
          timestamp: new Date().toLocaleTimeString(),
          durationMs: Math.round(performance.now() - start),
        });
        notify("success", `Product created with ID #${created.id} via GraphQL!`);
      }
      setIsProductModalOpen(false);
      resetProductForm();
      await loadProductsData();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Failed to save product via GraphQL");
    } finally {
      setProductSubmitting(false);
    }
  }

  async function handleDeleteProduct(id: number) {
    if (!confirm(`Delete product #${id} via GraphQL?`)) return;
    const start = performance.now();
    try {
      await gqlDeleteProduct(id);
      setLastOp({
        name: "DeleteProduct",
        type: "mutation",
        query: `mutation DeleteProduct($id: Int!) { deleteProduct(id: $id) }`,
        variables: { id },
        response: { deleted: true },
        timestamp: new Date().toLocaleTimeString(),
        durationMs: Math.round(performance.now() - start),
      });
      notify("success", `Product #${id} deleted via GraphQL!`);
      await loadProductsData();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Failed to delete product via GraphQL");
    }
  }

  function openEditProduct(p: GqlProduct) {
    setEditingProductId(p.id);
    setProductName(p.name);
    setProductDesc(p.description);
    setProductPrice(p.price.toString());
    setProductCategoryIds(p.categories.map((c) => c.id));
    setIsProductModalOpen(true);
  }

  function resetProductForm() {
    setEditingProductId(null);
    setProductName("");
    setProductDesc("");
    setProductPrice("");
    setProductCategoryIds([]);
  }

  // ---------------- Category Handlers ----------------

  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault();
    setCategorySubmitting(true);
    const start = performance.now();
    try {
      if (editingCategoryId) {
        const updated = await gqlUpdateCategory(editingCategoryId, categoryName.trim());
        setLastOp({
          name: "UpdateCategory",
          type: "mutation",
          query: `mutation UpdateCategory($id: Int!, $input: CategoryUpdateInput!) { ... }`,
          variables: { id: editingCategoryId, input: { name: categoryName } },
          response: updated,
          timestamp: new Date().toLocaleTimeString(),
          durationMs: Math.round(performance.now() - start),
        });
        notify("success", `Category #${editingCategoryId} updated via GraphQL!`);
      } else {
        const created = await gqlCreateCategory(categoryName.trim());
        setLastOp({
          name: "CreateCategory",
          type: "mutation",
          query: `mutation CreateCategory($input: CategoryCreateInput!) { ... }`,
          variables: { input: { name: categoryName } },
          response: created,
          timestamp: new Date().toLocaleTimeString(),
          durationMs: Math.round(performance.now() - start),
        });
        notify("success", `Category created with ID #${created.id} via GraphQL!`);
      }
      setIsCategoryModalOpen(false);
      setEditingCategoryId(null);
      setCategoryName("");
      await loadCategoriesData();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Failed to save category via GraphQL");
    } finally {
      setCategorySubmitting(false);
    }
  }

  async function handleDeleteCategory(id: number) {
    if (!confirm(`Delete category #${id} via GraphQL?`)) return;
    const start = performance.now();
    try {
      await gqlDeleteCategory(id);
      setLastOp({
        name: "DeleteCategory",
        type: "mutation",
        query: `mutation DeleteCategory($id: Int!) { deleteCategory(id: $id) }`,
        variables: { id },
        response: { deleted: true },
        timestamp: new Date().toLocaleTimeString(),
        durationMs: Math.round(performance.now() - start),
      });
      notify("success", `Category #${id} deleted via GraphQL!`);
      await loadCategoriesData();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Failed to delete category via GraphQL");
    }
  }

  // ---------------- User Handlers ----------------

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setUserSubmitting(true);
    const start = performance.now();
    try {
      const created = await gqlCreateUser({
        username: newUsername.trim(),
        password: newPassword,
        role: newUserRole,
      });
      setLastOp({
        name: "CreateUser",
        type: "mutation",
        query: `mutation CreateUser($input: UserCreateInput!) { ... }`,
        variables: { input: { username: newUsername, role: newUserRole } },
        response: created,
        timestamp: new Date().toLocaleTimeString(),
        durationMs: Math.round(performance.now() - start),
      });
      notify("success", `User @${created.username} created via GraphQL!`);
      setIsUserModalOpen(false);
      setNewUsername("");
      setNewPassword("");
      setNewUserRole("user");
      await loadUsersData();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Failed to create user via GraphQL");
    } finally {
      setUserSubmitting(false);
    }
  }

  async function handleToggleUserStatus(u: AuthUser) {
    const start = performance.now();
    try {
      const updated = await gqlUpdateUser(u.id, { isActive: !u.is_active });
      setLastOp({
        name: "UpdateUser",
        type: "mutation",
        query: `mutation UpdateUser($id: Int!, $input: UserUpdateInput!) { ... }`,
        variables: { id: u.id, input: { isActive: !u.is_active } },
        response: updated,
        timestamp: new Date().toLocaleTimeString(),
        durationMs: Math.round(performance.now() - start),
      });
      notify("success", `User @${u.username} status toggled via GraphQL!`);
      await loadUsersData();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Failed to toggle user status via GraphQL");
    }
  }

  async function handleToggleUserRole(u: AuthUser) {
    const newRole = u.role === "admin" ? "user" : "admin";
    const start = performance.now();
    try {
      const updated = await gqlUpdateUser(u.id, { role: newRole });
      setLastOp({
        name: "UpdateUser",
        type: "mutation",
        query: `mutation UpdateUser($id: Int!, $input: UserUpdateInput!) { ... }`,
        variables: { id: u.id, input: { role: newRole } },
        response: updated,
        timestamp: new Date().toLocaleTimeString(),
        durationMs: Math.round(performance.now() - start),
      });
      notify("success", `User @${u.username} role changed to ${newRole} via GraphQL!`);
      await loadUsersData();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Failed to update user role via GraphQL");
    }
  }

  async function handleDeleteUser(id: number) {
    if (!confirm(`Delete user #${id} via GraphQL?`)) return;
    const start = performance.now();
    try {
      await gqlDeleteUser(id);
      setLastOp({
        name: "DeleteUser",
        type: "mutation",
        query: `mutation DeleteUser($id: Int!) { deleteUser(id: $id) }`,
        variables: { id },
        response: { deleted: true },
        timestamp: new Date().toLocaleTimeString(),
        durationMs: Math.round(performance.now() - start),
      });
      notify("success", `User #${id} deleted via GraphQL!`);
      await loadUsersData();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Failed to delete user via GraphQL");
    }
  }

  // ---------------- Explorer Handlers ----------------

  function handleSelectPreset(presetKey: string) {
    setSelectedPreset(presetKey);
    const preset = PRESET_QUERIES[presetKey];
    if (preset) {
      setCustomQuery(preset.query);
      setCustomVariables(JSON.stringify(preset.variables, null, 2));
    }
  }

  async function handleExecuteExplorer() {
    setExplorerLoading(true);
    setExplorerStatus("idle");
    const start = performance.now();
    try {
      let parsedVariables: Record<string, unknown> = {};
      if (customVariables.trim()) {
        try {
          parsedVariables = JSON.parse(customVariables);
        } catch {
          throw new Error("Invalid JSON in Variables editor");
        }
      }

      const res = await graphqlRequest<unknown>(customQuery, parsedVariables);
      const elapsed = Math.round(performance.now() - start);
      setExplorerTiming(elapsed);
      setExplorerStatus("success");
      setExplorerResult(JSON.stringify(res, null, 2));
      setLastOp({
        name: "CustomExplorerRequest",
        type: customQuery.trim().startsWith("mutation") ? "mutation" : "query",
        query: customQuery,
        variables: parsedVariables,
        response: res,
        timestamp: new Date().toLocaleTimeString(),
        durationMs: elapsed,
      });
    } catch (err) {
      const elapsed = Math.round(performance.now() - start);
      setExplorerTiming(elapsed);
      setExplorerStatus("error");
      setExplorerResult(
        JSON.stringify(
          {
            error: err instanceof Error ? err.message : String(err),
          },
          null,
          2
        )
      );
    } finally {
      setExplorerLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-16">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-5 py-3 shadow-xl backdrop-blur-md transition-all ${
            notification.type === "success"
              ? "border border-teal-500/40 bg-teal-900/90 text-teal-100"
              : "border border-rose-500/40 bg-rose-900/90 text-rose-100"
          }`}
        >
          <span className="text-lg">{notification.type === "success" ? "✓" : "⚠️"}</span>
          <p className="text-xs font-medium">{notification.message}</p>
        </div>
      )}

      {/* Header Banner */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-teal-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-teal-700 border border-teal-200">
                  GraphQL Engine
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active on /graphql
                </span>
              </div>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
                GraphQL Management Studio
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Unified CRUD operations powered by Strawberry GraphQL schema & Next.js frontend client.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href={GRAPHQL_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-teal-600"
              >
                <span>Launch GraphiQL IDE</span>
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>

              {currentUser ? (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
                  <span className="text-slate-500">Logged in as:</span>
                  <span className="font-bold text-slate-900">@{currentUser.username}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      isAdmin ? "bg-teal-100 text-teal-800" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {currentUser.role}
                  </span>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                  Viewer mode (Sign in as admin to test write mutations)
                </div>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-100 pb-1">
            <button
              onClick={() => setActiveTab("products")}
              className={`flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-xs font-bold transition ${
                activeTab === "products"
                  ? "border-teal-500 text-teal-700 bg-teal-50/50"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              <span>Products CRUD</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {products.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("categories")}
              className={`flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-xs font-bold transition ${
                activeTab === "categories"
                  ? "border-teal-500 text-teal-700 bg-teal-50/50"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              <span>Categories CRUD</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {categories.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("users")}
              className={`flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-xs font-bold transition ${
                activeTab === "users"
                  ? "border-teal-500 text-teal-700 bg-teal-50/50"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              <span>Users CRUD</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {users.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("explorer")}
              className={`flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-xs font-bold transition ${
                activeTab === "explorer"
                  ? "border-teal-500 text-teal-700 bg-teal-50/50"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              <span>Interactive Query Explorer</span>
              <span className="rounded bg-teal-500/20 px-1.5 py-0.2 text-[9px] font-bold text-teal-700">
                Live Console
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Main Workspace Column */}
          <div className="lg:col-span-3 space-y-6">
            {/* TAB: PRODUCTS */}
            {activeTab === "products" && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Products (GraphQL)</h2>
                    <p className="text-xs text-slate-500">
                      Querying <code className="text-teal-600 font-mono">products(...)</code> with nested category relations.
                    </p>
                  </div>
                  {isAdmin ? (
                    <button
                      onClick={() => {
                        resetProductForm();
                        setIsProductModalOpen(true);
                      }}
                      className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-teal-700"
                    >
                      + Create Product
                    </button>
                  ) : null}
                </div>

                {/* Filters */}
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && loadProductsData()}
                      placeholder="Search products via GraphQL search argument..."
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-teal-500 focus:bg-white"
                    />
                  </div>
                  <select
                    value={selectedCatFilter}
                    onChange={(e) =>
                      setSelectedCatFilter(e.target.value === "all" ? "all" : Number(e.target.value))
                    }
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none focus:border-teal-500 focus:bg-white"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => loadProductsData()}
                    disabled={productsLoading}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {productsLoading ? "Refreshing..." : "Query GraphQL"}
                  </button>
                </div>

                {/* Products Table */}
                <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
                  {productsLoading ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent"></div>
                      <p className="mt-2">Executing products GraphQL query...</p>
                    </div>
                  ) : products.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No products returned by GraphQL query.
                    </div>
                  ) : (
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                          <th className="px-4 py-2.5">ID</th>
                          <th className="px-4 py-2.5">Name</th>
                          <th className="px-4 py-2.5">Price</th>
                          <th className="px-4 py-2.5">Categories</th>
                          {isAdmin && <th className="px-4 py-2.5 text-right">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {products.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/75 transition">
                            <td className="px-4 py-3 font-mono text-slate-400">#{p.id}</td>
                            <td className="px-4 py-3">
                              <span className="font-semibold text-slate-900">{p.name}</span>
                              <p className="text-[11px] text-slate-500 line-clamp-1">{p.description}</p>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-900">
                              ${p.price.toFixed(2)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {p.categories.map((c) => (
                                  <span
                                    key={c.id}
                                    className="rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700 border border-teal-100"
                                  >
                                    {c.name}
                                  </span>
                                ))}
                                {p.categories.length === 0 && (
                                  <span className="text-[10px] text-slate-400 italic">None</span>
                                )}
                              </div>
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => openEditProduct(p)}
                                    className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProduct(p.id)}
                                    className="rounded border border-rose-200 bg-white px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* TAB: CATEGORIES */}
            {activeTab === "categories" && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Categories (GraphQL)</h2>
                    <p className="text-xs text-slate-500">
                      Querying <code className="text-teal-600 font-mono">categories(...)</code> with reverse product relations.
                    </p>
                  </div>
                  {isAdmin ? (
                    <button
                      onClick={() => {
                        setEditingCategoryId(null);
                        setCategoryName("");
                        setIsCategoryModalOpen(true);
                      }}
                      className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-teal-700"
                    >
                      + Create Category
                    </button>
                  ) : null}
                </div>

                <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
                  {categoriesLoading ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent"></div>
                      <p className="mt-2">Executing categories GraphQL query...</p>
                    </div>
                  ) : categories.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No categories found.
                    </div>
                  ) : (
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                          <th className="px-4 py-2.5">ID</th>
                          <th className="px-4 py-2.5">Category Name</th>
                          <th className="px-4 py-2.5">Linked Products</th>
                          {isAdmin && <th className="px-4 py-2.5 text-right">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {categories.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50/75 transition">
                            <td className="px-4 py-3 font-mono text-slate-400">#{c.id}</td>
                            <td className="px-4 py-3 font-semibold text-slate-900">{c.name}</td>
                            <td className="px-4 py-3">
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 font-medium">
                                {c.products ? c.products.length : 0} items
                              </span>
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => {
                                      setEditingCategoryId(c.id);
                                      setCategoryName(c.name);
                                      setIsCategoryModalOpen(true);
                                    }}
                                    className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCategory(c.id)}
                                    className="rounded border border-rose-200 bg-white px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* TAB: USERS */}
            {activeTab === "users" && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Users (GraphQL)</h2>
                    <p className="text-xs text-slate-500">
                      Querying <code className="text-teal-600 font-mono">users(...)</code> with active Bearer token.
                    </p>
                  </div>
                  {isAdmin ? (
                    <button
                      onClick={() => {
                        setNewUsername("");
                        setNewPassword("");
                        setNewUserRole("user");
                        setIsUserModalOpen(true);
                      }}
                      className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-teal-700"
                    >
                      + Create User
                    </button>
                  ) : null}
                </div>

                <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
                  {usersLoading ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent"></div>
                      <p className="mt-2">Executing users GraphQL query...</p>
                    </div>
                  ) : users.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No users returned or authorization required.
                    </div>
                  ) : (
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                          <th className="px-4 py-2.5">User</th>
                          <th className="px-4 py-2.5">Role</th>
                          <th className="px-4 py-2.5">Status</th>
                          {isAdmin && <th className="px-4 py-2.5 text-right">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {users.map((u) => {
                          const isSelf = currentUser?.id === u.id;
                          return (
                            <tr key={u.id} className="hover:bg-slate-50/75 transition">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-900">{u.username}</span>
                                  {isSelf && (
                                    <span className="rounded bg-teal-100 px-1.5 py-0.2 text-[9px] font-bold text-teal-800">
                                      You
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-400">ID #{u.id}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    u.role === "admin"
                                      ? "bg-slate-900 text-teal-300"
                                      : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {u.role}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    u.is_active
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : "bg-rose-50 text-rose-700 border border-rose-200"
                                  }`}
                                >
                                  {u.is_active ? "Active" : "Disabled"}
                                </span>
                              </td>
                              {isAdmin && (
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      disabled={isSelf}
                                      onClick={() => handleToggleUserRole(u)}
                                      className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                                    >
                                      {u.role === "admin" ? "Demote" : "Make Admin"}
                                    </button>
                                    <button
                                      disabled={isSelf}
                                      onClick={() => handleToggleUserStatus(u)}
                                      className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                                    >
                                      {u.is_active ? "Disable" : "Enable"}
                                    </button>
                                    <button
                                      disabled={isSelf}
                                      onClick={() => handleDeleteUser(u.id)}
                                      className="rounded border border-rose-200 bg-white px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* TAB: INTERACTIVE EXPLORER */}
            {activeTab === "explorer" && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Interactive Query Console</h2>
                    <p className="text-xs text-slate-500">
                      Execute arbitrary GraphQL documents directly against the live backend endpoint.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-600">Preset:</label>
                    <select
                      value={selectedPreset}
                      onChange={(e) => handleSelectPreset(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-teal-500"
                    >
                      {Object.keys(PRESET_QUERIES).map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Left Editor */}
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between pb-1">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          GraphQL Document (Query / Mutation)
                        </label>
                      </div>
                      <textarea
                        rows={12}
                        value={customQuery}
                        onChange={(e) => setCustomQuery(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-xs text-emerald-300 outline-none focus:ring-1 focus:ring-teal-500"
                        placeholder="Write GraphQL query or mutation..."
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 pb-1">
                        Variables (JSON)
                      </label>
                      <textarea
                        rows={5}
                        value={customVariables}
                        onChange={(e) => setCustomVariables(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-xs text-teal-200 outline-none focus:ring-1 focus:ring-teal-500"
                        placeholder="{}"
                      />
                    </div>

                    <button
                      onClick={handleExecuteExplorer}
                      disabled={explorerLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
                    >
                      {explorerLoading ? (
                        <>
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>Executing GraphQL Request...</span>
                        </>
                      ) : (
                        <>
                          <span>▶ Execute Request</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Right Response Viewer */}
                  <div>
                    <div className="flex items-center justify-between pb-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        GraphQL Response JSON
                      </label>
                      {explorerTiming !== null && (
                        <div className="flex items-center gap-2 text-[10px]">
                          <span
                            className={`rounded px-1.5 py-0.5 font-bold ${
                              explorerStatus === "success"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {explorerStatus === "success" ? "200 OK" : "ERROR"}
                          </span>
                          <span className="text-slate-400 font-mono">{explorerTiming} ms</span>
                        </div>
                      )}
                    </div>
                    <pre className="h-[430px] overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-xs text-slate-200">
                      {explorerResult}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar / GraphQL Inspector */}
          <div className="space-y-6">
            {/* Live Inspector Widget */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  GraphQL Live Inspector
                </h3>
                {lastOp && (
                  <span className="rounded bg-teal-50 px-1.5 py-0.5 font-mono text-[10px] text-teal-700 border border-teal-200">
                    {lastOp.durationMs}ms
                  </span>
                )}
              </div>

              {lastOp ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Operation:</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          lastOp.type === "mutation"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-teal-100 text-teal-800"
                        }`}
                      >
                        {lastOp.type}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-800">
                        {lastOp.name}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Executed Query:</span>
                    <pre className="mt-1 max-h-36 overflow-auto rounded bg-slate-950 p-2 font-mono text-[10px] text-emerald-300">
                      {lastOp.query}
                    </pre>
                  </div>

                  {lastOp.variables && Object.keys(lastOp.variables).length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Variables:</span>
                      <pre className="mt-1 max-h-24 overflow-auto rounded bg-slate-950 p-2 font-mono text-[10px] text-teal-300">
                        {JSON.stringify(lastOp.variables, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Response Payload:</span>
                    <pre className="mt-1 max-h-36 overflow-auto rounded bg-slate-950 p-2 font-mono text-[10px] text-slate-200">
                      {JSON.stringify(lastOp.response, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="mt-6 text-center text-xs text-slate-400 py-8">
                  <p>No transactions yet.</p>
                  <p className="mt-1 text-[11px]">Perform a CRUD action or run a query to inspect live GraphQL payloads.</p>
                </div>
              )}
            </div>

            {/* Architecture Overview */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100">
                GraphQL Architecture
              </h3>
              <ul className="mt-3 space-y-2 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-teal-600 font-bold">✓</span>
                  <span><strong>Strawberry GraphQL:</strong> Type-safe Python engine running on FastAPI.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-600 font-bold">✓</span>
                  <span><strong>Full CRUD:</strong> Queries and mutations for Products, Categories, Users.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-600 font-bold">✓</span>
                  <span><strong>JWT Authentication:</strong> Context getter validates Bearer tokens on protected resolvers.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-600 font-bold">✓</span>
                  <span><strong>GraphiQL IDE:</strong> Live interactive browser schema documentation.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Product Modal (Create / Edit) */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingProductId ? `Edit Product #${editingProductId}` : "Create New Product (GraphQL)"}
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-slate-400 hover:text-slate-900 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-teal-500 focus:bg-white"
                  placeholder="e.g. Wireless Mouse"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={productDesc}
                  onChange={(e) => setProductDesc(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-teal-500 focus:bg-white"
                  placeholder="e.g. Ergonomic wireless mouse..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={productPrice}
                  onChange={(e) => setProductPrice(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-teal-500 focus:bg-white"
                  placeholder="e.g. 29.99"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Categories
                </label>
                <div className="mt-1 flex flex-wrap gap-1.5 max-h-32 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                  {categories.map((cat) => {
                    const isChecked = productCategoryIds.includes(cat.id);
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => {
                          if (isChecked) {
                            setProductCategoryIds(productCategoryIds.filter((id) => id !== cat.id));
                          } else {
                            setProductCategoryIds([...productCategoryIds, cat.id]);
                          }
                        }}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                          isChecked
                            ? "bg-teal-600 text-white"
                            : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {isChecked ? `✓ ${cat.name}` : `+ ${cat.name}`}
                      </button>
                    );
                  })}
                  {categories.length === 0 && (
                    <span className="text-xs text-slate-400">No categories created yet.</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={productSubmitting}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
                >
                  {productSubmitting ? "Executing Mutation..." : "Save Product (GraphQL)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal (Create / Edit) */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingCategoryId ? `Edit Category #${editingCategoryId}` : "Create Category (GraphQL)"}
              </h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-900 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Category Name
                </label>
                <input
                  type="text"
                  required
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-teal-500 focus:bg-white"
                  placeholder="e.g. Computers"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={categorySubmitting}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
                >
                  {categorySubmitting ? "Executing Mutation..." : "Save Category (GraphQL)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Modal (Create) */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Create User (GraphQL)</h3>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-900 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-teal-500 focus:bg-white"
                  placeholder="e.g. morgan"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-teal-500 focus:bg-white"
                  placeholder="Min 4 characters"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Role
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as "user" | "admin")}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-teal-500 focus:bg-white"
                >
                  <option value="user">User (Standard)</option>
                  <option value="admin">Admin (Full Privileges)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={userSubmitting}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
                >
                  {userSubmitting ? "Executing..." : "Create User (GraphQL)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
