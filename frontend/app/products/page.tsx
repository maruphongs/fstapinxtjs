"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { API_URL, AuthUser, authFetch, getUser } from "../lib/auth";

type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  thumbnail?: string | null;
  categories: { id: number; name: string }[];
};
type Category = { id: number; name: string; products?: { id: number; name: string; price: number }[] };
type SortKey = "id" | "name" | "price";
type ConnectionStatus = "checking" | "online" | "offline";

export default function ProductPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    categoryIds: [] as number[],
    editingId: null as number | null,
  });
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [removeThumbnail, setRemoveThumbnail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [ui, setUi] = useState({
    isModalOpen: false,
    actionMenuId: null as number | null,
    actionMenuPosition: null as { top: number; right: number } | null,
    loading: true,
    submitting: false,
    deletingId: null as number | null,
    sortKey: "id" as SortKey,
    sortAscending: true,
  });
  const [status, setStatus] = useState<{ connection: ConnectionStatus; error: string }>({
    connection: "checking",
    error: "",
  });
  const actionButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    setUser(getUser());
    const handleAuthChange = () => setUser(getUser());
    window.addEventListener("auth-changed", handleAuthChange);
    return () => window.removeEventListener("auth-changed", handleAuthChange);
  }, []);

  async function loadProducts(showLoading = false) {
    try {
      if (showLoading) setUi((current) => ({ ...current, loading: true }));
      const response = await fetch(`${API_URL}/products`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load products.");
      setProducts(await response.json());
      setStatus({ connection: "online", error: "" });
    } catch (err) {
      setStatus((current) => ({
        ...current,
        connection: "offline",
        error: showLoading && err instanceof Error ? err.message : "Could not load products.",
      }));
    } finally {
      setUi((current) => ({ ...current, loading: false }));
    }
  }

  async function loadCategories() {
    try {
      const response = await fetch(`${API_URL}/categories`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load categories.");
      setCategories(await response.json());
    } catch (err) {
      setStatus((current) => ({
        ...current,
        error: err instanceof Error ? err.message : "Could not load categories.",
      }));
    }
  }

  useEffect(() => {
    void loadProducts(true);
    void loadCategories();
    const refreshTimer = window.setInterval(() => void loadProducts(), 10000);
    return () => window.clearInterval(refreshTimer);
  }, []);

  useEffect(() => {
    if (!ui.isModalOpen && ui.actionMenuId === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !ui.submitting) {
        setUi((current) => ({
          ...current,
          isModalOpen: false,
          actionMenuId: null,
          actionMenuPosition: null,
        }));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [ui.isModalOpen, ui.actionMenuId, ui.submitting]);

  useEffect(() => {
    if (!ui.actionMenuId) return;
    const updatePosition = () => {
      const button = actionButtonRefs.current[ui.actionMenuId!];
      if (!button) return;
      const bounds = button.getBoundingClientRect();
      const menuHeight = 110;
      setUi((current) => ({
        ...current,
        actionMenuPosition: {
          top:
            bounds.bottom + 4 > window.innerHeight - menuHeight
              ? bounds.top - menuHeight - 4
              : bounds.bottom + 4,
          right: window.innerWidth - bounds.right,
        },
      }));
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [ui.actionMenuId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) {
      setStatus({ connection: "online", error: "Admin permissions required to add or edit products." });
      return;
    }
    const isEditing = form.editingId !== null;

    try {
      setUi((current) => ({ ...current, submitting: true }));
      setStatus({ connection: "online", error: "" });

      const bodyPayload = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        category_ids: form.categoryIds,
      };

      const response = await authFetch(
        `${API_URL}/products${isEditing ? `/${form.editingId}` : ""}`,
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
        }
      );

      if (!response.ok) {
        const details = await response.json().catch(() => null);
        throw new Error(details?.detail ?? `Could not ${isEditing ? "update" : "add"} product.`);
      }

      const saved = (await response.json()) as Product;

      if (thumbnailFile && saved.id) {
        const formData = new FormData();
        formData.append("file", thumbnailFile);
        await authFetch(`${API_URL}/products/${saved.id}/thumbnail`, {
          method: "POST",
          body: formData,
        });
      } else if (removeThumbnail && saved.id) {
        await authFetch(`${API_URL}/products/${saved.id}/thumbnail`, {
          method: "DELETE",
        });
      }

      await loadProducts(false);
      setForm({ name: "", description: "", price: "", categoryIds: [], editingId: null });
      setThumbnailFile(null);
      setThumbnailPreview(null);
      setRemoveThumbnail(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUi((current) => ({ ...current, isModalOpen: false }));
    } catch (err) {
      setStatus({
        connection: "online",
        error: err instanceof Error ? err.message : "Could not save product.",
      });
    } finally {
      setUi((current) => ({ ...current, submitting: false }));
    }
  }

  async function handleDelete(id: number) {
    if (!isAdmin) {
      setStatus({ connection: "online", error: "Admin permissions required to delete products." });
      return;
    }

    try {
      setUi((current) => ({
        ...current,
        actionMenuId: null,
        actionMenuPosition: null,
        deletingId: id,
      }));
      setStatus({ connection: "online", error: "" });
      const response = await authFetch(`${API_URL}/products/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const details = await response.json().catch(() => null);
        throw new Error(details?.detail ?? "Could not delete product.");
      }
      setProducts((current) => current.filter((product) => product.id !== id));
    } catch (err) {
      setStatus({
        connection: "online",
        error: err instanceof Error ? err.message : "Could not delete product.",
      });
    } finally {
      setUi((current) => ({ ...current, deletingId: null }));
    }
  }

  async function handleRemoveThumbnail(productId: number) {
    if (!isAdmin) return;
    try {
      setUi((current) => ({ ...current, actionMenuId: null, actionMenuPosition: null }));
      setStatus({ connection: "online", error: "" });
      const response = await authFetch(`${API_URL}/products/${productId}/thumbnail`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const details = await response.json().catch(() => null);
        throw new Error(details?.detail ?? "Could not remove thumbnail.");
      }
      setProducts((current) =>
        current.map((p) => (p.id === productId ? { ...p, thumbnail: null } : p))
      );
    } catch (err) {
      setStatus({
        connection: "online",
        error: err instanceof Error ? err.message : "Failed to remove thumbnail.",
      });
    }
  }

  const openAddProduct = () => {
    if (!isAdmin) {
      setStatus({ connection: "online", error: "Please log in as an admin to add products." });
      return;
    }
    setForm({ name: "", description: "", price: "", categoryIds: [], editingId: null });
    setThumbnailFile(null);
    setThumbnailPreview(null);
    setRemoveThumbnail(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUi((current) => ({
      ...current,
      isModalOpen: true,
      actionMenuId: null,
      actionMenuPosition: null,
    }));
    setStatus({ connection: "online", error: "" });
  };

  const openEditProduct = (product: Product) => {
    if (!isAdmin) return;
    setForm({
      name: product.name,
      description: product.description,
      price: String(product.price),
      categoryIds: product.categories.map((category) => category.id),
      editingId: product.id,
    });
    setThumbnailFile(null);
    setThumbnailPreview(
      product.thumbnail
        ? product.thumbnail.startsWith("http")
          ? product.thumbnail
          : `${API_URL}${product.thumbnail}`
        : null
    );
    setRemoveThumbnail(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUi((current) => ({
      ...current,
      isModalOpen: true,
      actionMenuId: null,
      actionMenuPosition: null,
    }));
    setStatus({ connection: "online", error: "" });
  };

  const handleSort = (key: SortKey) =>
    setUi((current) => ({
      ...current,
      sortKey: key,
      sortAscending: current.sortKey === key ? !current.sortAscending : true,
    }));

  const sorted = [...products].sort((a, b) => {
    const aValue = a[ui.sortKey];
    const bValue = b[ui.sortKey];
    const comparison =
      typeof aValue === "string"
        ? aValue.localeCompare(String(bValue))
        : Number(aValue) - Number(bValue);
    return ui.sortAscending ? comparison : -comparison;
  });

  const activeProduct = products.find((product) => product.id === ui.actionMenuId);

  return (
    <main className="min-h-screen bg-white px-4 py-10 font-sans text-black sm:px-6 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-teal-700">Catalog</p>
            <h1 className="text-4xl font-bold tracking-tight">Products</h1>
            <p className="mt-2 max-w-xl text-slate-600">
              Manage your product catalog and its category relationships.
            </p>
          </div>
          {isAdmin ? (
            <button
              type="button"
              className="w-full bg-[#111111] px-5 py-3 font-bold text-white shadow-md transition hover:bg-[#009688] sm:w-auto"
              onClick={openAddProduct}
            >
              + Add product
            </button>
          ) : null}
        </header>

        <section className="border border-slate-200 bg-white p-5 sm:p-7 shadow-sm">
          <div className="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Product collection</h2>
              <span className="text-sm text-slate-500">
                {products.length} {products.length === 1 ? "product" : "products"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Sort products">
              {(["id", "name", "price"] as const).map((column) => (
                <button
                  key={column}
                  type="button"
                  className={`border px-3 py-2 text-xs font-bold uppercase tracking-wide ${
                    ui.sortKey === column
                      ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 text-slate-500 hover:border-slate-400"
                  }`}
                  onClick={() => handleSort(column)}
                >
                  {column} {ui.sortKey === column ? (ui.sortAscending ? "↑" : "↓") : "↕"}
                </button>
              ))}
            </div>
          </div>
          {status.error && (
            <p className="mt-4 text-sm text-red-700 bg-red-50 p-3 border border-red-200 rounded" role="alert">
              {status.error}
            </p>
          )}
          {ui.loading ? (
            <p className="mt-8 text-slate-500">Loading products...</p>
          ) : products.length === 0 ? (
            <div className="mt-8 border border-dashed border-slate-300 px-6 py-12 text-center">
              <p className="font-bold">No products yet.</p>
              <p className="mt-1 text-sm text-slate-500">Add your first product to start building the catalog.</p>
            </div>
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map((product) => (
                <article
                  key={product.id}
                  className="group relative flex min-h-64 flex-col border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <span className="font-mono text-xs text-slate-400">
                      #{String(product.id).padStart(3, "0")}
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        ref={(button) => {
                          actionButtonRefs.current[product.id] = button;
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center border border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                        onClick={() =>
                          setUi((current) => ({
                            ...current,
                            actionMenuId: current.actionMenuId === product.id ? null : product.id,
                            actionMenuPosition:
                              current.actionMenuId === product.id ? null : current.actionMenuPosition,
                          }))
                        }
                        aria-expanded={ui.actionMenuId === product.id}
                        aria-controls={`actions-${product.id}`}
                        aria-label={`Actions for ${product.name}`}
                      >
                        <span className="flex flex-col gap-1" aria-hidden="true">
                          {[1, 2, 3].map((item) => (
                            <span key={item} className="h-1 w-1 rounded-full bg-current" />
                          ))}
                        </span>
                      </button>
                    )}
                  </div>
                  {product.thumbnail && (
                    <div className="group/thumb relative mb-4 aspect-video w-full overflow-hidden rounded bg-slate-50 border border-slate-100 flex items-center justify-center">
                      <img
                        src={
                          product.thumbnail.startsWith("http")
                            ? product.thumbnail
                            : `${API_URL}${product.thumbnail}`
                        }
                        alt={product.name}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        onError={(e) => {
                          const parent = (e.currentTarget as HTMLElement).parentElement;
                          if (parent) parent.style.display = "none";
                        }}
                      />
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleRemoveThumbnail(product.id);
                          }}
                          title="Remove thumbnail"
                          className="absolute top-2 right-2 rounded bg-black/75 hover:bg-red-600 text-white p-1.5 text-xs opacity-0 group-hover/thumb:opacity-100 transition-opacity backdrop-blur-xs cursor-pointer shadow-md"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                  <h3 className="pr-8 text-xl font-bold tracking-tight">{product.name}</h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{product.description}</p>
                  <div className="mt-auto pt-6">
                    <div className="flex items-end justify-between gap-4">
                      <span className="text-2xl font-bold text-emerald-800">
                        ${product.price.toFixed(2)}
                      </span>
                      <span className="text-xs uppercase tracking-wide text-slate-400">Product</span>
                    </div>
                    <div className="mt-4 flex min-h-6 flex-wrap gap-2">
                      {product.categories.length > 0 ? (
                        product.categories.map((category) => (
                          <span
                            key={category.id}
                            className="border border-emerald-100 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800"
                          >
                            {category.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">Uncategorized</span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Action dropdown menu */}
        {isAdmin && activeProduct && ui.actionMenuPosition && (
          <div
            id={`actions-${activeProduct.id}`}
            className="fixed z-50 min-w-36 border border-slate-200 bg-white p-1 shadow-lg rounded"
            style={ui.actionMenuPosition}
          >
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-emerald-700"
              onClick={() => openEditProduct(activeProduct)}
            >
              Edit
            </button>
            {activeProduct.thumbnail && (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm font-semibold text-amber-700 hover:bg-amber-50"
                onClick={() => void handleRemoveThumbnail(activeProduct.id)}
              >
                Remove thumbnail
              </button>
            )}
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm font-bold text-red-700 hover:bg-red-50 hover:text-red-900"
              onClick={() => void handleDelete(activeProduct.id)}
              disabled={ui.deletingId === activeProduct.id}
            >
              {ui.deletingId === activeProduct.id ? "Deleting..." : "Delete"}
            </button>
          </div>
        )}

        {/* Add / Edit Product Modal */}
        {isAdmin && ui.isModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !ui.submitting) {
                setUi((current) => ({ ...current, isModalOpen: false }));
              }
            }}
          >
            <section
              className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto"
              role="dialog"
              aria-modal="true"
            >
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900">
                    {form.editingId === null ? "Add Product" : "Edit Product"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {form.editingId === null
                      ? "Create a new catalog item."
                      : `Update product #${form.editingId}.`}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-2xl text-slate-400 hover:text-black leading-none p-1"
                  onClick={() => setUi((current) => ({ ...current, isModalOpen: false }))}
                  disabled={ui.submitting}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Name
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#009688] focus:bg-white"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Product name"
                    autoFocus
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Description
                  </label>
                  <textarea
                    className="w-full min-h-20 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#009688] focus:bg-white"
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, description: event.target.value }))
                    }
                    placeholder="Detailed description"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#009688] focus:bg-white"
                    value={form.price}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, price: event.target.value }))
                    }
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Thumbnail Image
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setThumbnailFile(file);
                      if (file) {
                        setRemoveThumbnail(false);
                        setThumbnailPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                  {thumbnailPreview && (
                    <div className="mt-2.5 flex items-center gap-3">
                      <div className="h-20 w-32 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                        <img src={thumbnailPreview} alt="Preview" className="h-full w-full object-cover" />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setThumbnailFile(null);
                          setThumbnailPreview(null);
                          setRemoveThumbnail(true);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100 transition cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        <span>Remove thumbnail</span>
                      </button>
                    </div>
                  )}
                </div>

                <fieldset>
                  <legend className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Categories
                  </legend>
                  {categories.length === 0 ? (
                    <p className="border border-dashed border-slate-200 p-2 text-xs text-slate-400 rounded-lg">
                      No categories available. Create categories in the Categories page.
                    </p>
                  ) : (
                    <div className="grid max-h-32 gap-2 overflow-y-auto border border-slate-200 bg-slate-50 p-2.5 rounded-lg sm:grid-cols-2">
                      {categories.map((category) => (
                        <label
                          key={category.id}
                          className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={form.categoryIds.includes(category.id)}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                categoryIds: event.target.checked
                                  ? [...current.categoryIds, category.id]
                                  : current.categoryIds.filter((id) => id !== category.id),
                              }))
                            }
                            className="rounded text-[#009688] focus:ring-[#009688]"
                          />
                          <span>{category.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>

                {status.error && (
                  <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    {status.error}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => setUi((current) => ({ ...current, isModalOpen: false }))}
                    disabled={ui.submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-[#009688] px-4 py-2 text-xs font-semibold text-white hover:bg-[#00796b] disabled:opacity-50"
                    disabled={ui.submitting}
                  >
                    {ui.submitting
                      ? form.editingId === null
                        ? "Creating..."
                        : "Saving..."
                      : form.editingId === null
                      ? "Add Product"
                      : "Update Product"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
