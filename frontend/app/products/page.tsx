"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { API_URL, AuthUser, authFetch, getUser } from "../lib/auth";

type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  categories: { id: number; name: string }[];
};
type Category = { id: number; name: string; products?: { id: number; name: string; price: number }[] };
type SortKey = "id" | "name" | "price";
type ConnectionStatus = "checking" | "online" | "offline";

export default function ProductPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({ name: "", description: "", price: "", categoryIds: [] as number[], editingId: null as number | null });
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
  const [status, setStatus] = useState<{ connection: ConnectionStatus; error: string }>({ connection: "checking", error: "" });
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
      setStatus((current) => ({ ...current, connection: "offline", error: showLoading && err instanceof Error ? err.message : "Could not load products." }));
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
      setStatus((current) => ({ ...current, error: err instanceof Error ? err.message : "Could not load categories." }));
    }
  }

  useEffect(() => {
    void loadProducts(true);
    void loadCategories();
    const refreshTimer = window.setInterval(() => void loadProducts(), 5000);
    return () => window.clearInterval(refreshTimer);
  }, []);

  useEffect(() => {
    if (!ui.isModalOpen && ui.actionMenuId === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !ui.submitting) setUi((current) => ({ ...current, isModalOpen: false, actionMenuId: null, actionMenuPosition: null }));
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
      const menuHeight = 88;
      setUi((current) => ({ ...current, actionMenuPosition: { top: bounds.bottom + 4 > window.innerHeight - menuHeight ? bounds.top - menuHeight - 4 : bounds.bottom + 4, right: window.innerWidth - bounds.right } }));
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
      const response = await authFetch(`${API_URL}/products${isEditing ? `/${form.editingId}` : ""}`, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          price: Number(form.price),
          category_ids: form.categoryIds,
        }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => null);
        throw new Error(details?.detail ?? `Could not ${isEditing ? "update" : "add"} product.`);
      }
      const saved = await response.json() as Product;
      const previousCategoryIds = isEditing ? products.find((product) => product.id === saved.id)?.categories.map((category) => category.id) ?? [] : [];
      await Promise.all([
        ...form.categoryIds.filter((id) => !previousCategoryIds.includes(id)).map((categoryId) => authFetch(`${API_URL}/products/${saved.id}/categories/${categoryId}`, { method: "POST" })),
        ...previousCategoryIds.filter((id) => !form.categoryIds.includes(id)).map((categoryId) => authFetch(`${API_URL}/products/${saved.id}/categories/${categoryId}`, { method: "DELETE" })),
      ]);
      const refreshedResponse = await fetch(`${API_URL}/products/${saved.id}`, { cache: "no-store" });
      if (!refreshedResponse.ok) throw new Error("Could not refresh product categories.");
      const refreshed = await refreshedResponse.json() as Product;
      setProducts((current) => isEditing ? current.map((product) => product.id === refreshed.id ? refreshed : product) : [...current, refreshed]);
      setForm({ name: "", description: "", price: "", categoryIds: [], editingId: null });
      setUi((current) => ({ ...current, isModalOpen: false }));
    } catch (err) {
      setStatus({ connection: "online", error: err instanceof Error ? err.message : "Could not save product." });
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
      setUi((current) => ({ ...current, actionMenuId: null, actionMenuPosition: null, deletingId: id }));
      setStatus({ connection: "online", error: "" });
      const response = await authFetch(`${API_URL}/products/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const details = await response.json().catch(() => null);
        throw new Error(details?.detail ?? "Could not delete product.");
      }
      setProducts((current) => current.filter((product) => product.id !== id));
    } catch (err) {
      setStatus({ connection: "online", error: err instanceof Error ? err.message : "Could not delete product." });
    } finally {
      setUi((current) => ({ ...current, deletingId: null }));
    }
  }

  const openAddProduct = () => {
    if (!isAdmin) {
      setStatus({ connection: "online", error: "Please log in as an admin to add products." });
      return;
    }
    setForm({ name: "", description: "", price: "", categoryIds: [], editingId: null });
    setUi((current) => ({ ...current, isModalOpen: true, actionMenuId: null, actionMenuPosition: null }));
    setStatus({ connection: "online", error: "" });
  };

  const openEditProduct = (product: Product) => {
    if (!isAdmin) return;
    setForm({ name: product.name, description: product.description, price: String(product.price), categoryIds: product.categories.map((category) => category.id), editingId: product.id });
    setUi((current) => ({ ...current, isModalOpen: true, actionMenuId: null, actionMenuPosition: null }));
    setStatus({ connection: "online", error: "" });
  };

  const handleSort = (key: SortKey) => setUi((current) => ({ ...current, sortKey: key, sortAscending: current.sortKey === key ? !current.sortAscending : true }));
  const sorted = [...products].sort((a, b) => {
    const aValue = a[ui.sortKey];
    const bValue = b[ui.sortKey];
    const comparison = typeof aValue === "string" ? aValue.localeCompare(String(bValue)) : Number(aValue) - Number(bValue);
    return ui.sortAscending ? comparison : -comparison;
  });
  const statusColors = { online: "border-teal-200 text-teal-800 bg-teal-50", offline: "border-red-200 text-red-800 bg-red-50", checking: "border-slate-200 text-slate-600 bg-slate-50" };
  const dotColors = { online: "bg-teal-600", offline: "bg-red-600", checking: "bg-slate-400" };
  const activeProduct = products.find((product) => product.id === ui.actionMenuId);

  return (
    <main className="min-h-screen bg-white px-4 py-10 font-sans text-black sm:px-6 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-teal-700">Catalog</p>
            <h1 className="text-4xl font-bold tracking-tight">Products</h1>
            <p className="mt-2 max-w-xl text-slate-600">Manage your product catalog and its category relationships.</p>
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
            <div><h2 className="text-2xl font-bold tracking-tight">Product collection</h2><span className="text-sm text-slate-500">{products.length} {products.length === 1 ? "product" : "products"}</span></div>
            <div className="flex flex-wrap gap-2" aria-label="Sort products">
              {(["id", "name", "price"] as const).map((column) => <button key={column} type="button" className={`border px-3 py-2 text-xs font-bold uppercase tracking-wide ${ui.sortKey === column ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-500 hover:border-slate-400"}`} onClick={() => handleSort(column)}>{column} {ui.sortKey === column ? (ui.sortAscending ? "↑" : "↓") : "↕"}</button>)}
            </div>
          </div>
          <div className={`flex items-center gap-2 border px-3 py-2 text-sm ${statusColors[status.connection]}`} role="status"><span className={`h-2 w-2 rounded-full ${dotColors[status.connection]}`} aria-hidden="true" /><span>{status.connection === "online" ? "Connected to catalog" : status.connection === "offline" ? "Catalog unavailable" : "Connecting..."}</span>{status.connection === "offline" && <button type="button" className="ml-auto font-bold underline" onClick={() => void loadProducts(true)}>Retry</button>}</div>
          {status.error && <p className="mt-4 text-sm text-red-700 bg-red-50 p-3 border border-red-200 rounded" role="alert">{status.error}</p>}
          {ui.loading ? <p className="mt-8 text-slate-500">Loading products...</p> : products.length === 0 ? <div className="mt-8 border border-dashed border-slate-300 px-6 py-12 text-center"><p className="font-bold">No products yet.</p><p className="mt-1 text-sm text-slate-500">Add your first product to start building the catalog.</p></div> : <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{sorted.map((product) => <article key={product.id} className="group relative flex min-h-64 flex-col border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg">
            <div className="mb-8 flex items-start justify-between gap-4">
              <span className="font-mono text-xs text-slate-400">#{String(product.id).padStart(3, "0")}</span>
              {isAdmin && (
                <button type="button" ref={(button) => { actionButtonRefs.current[product.id] = button; }} className="inline-flex h-9 w-9 items-center justify-center border border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900" onClick={() => setUi((current) => ({ ...current, actionMenuId: current.actionMenuId === product.id ? null : product.id, actionMenuPosition: current.actionMenuId === product.id ? null : current.actionMenuPosition }))} aria-expanded={ui.actionMenuId === product.id} aria-controls={`actions-${product.id}`} aria-label={`Actions for ${product.name}`}><span className="flex flex-col gap-1" aria-hidden="true">{[1, 2, 3].map((item) => <span key={item} className="h-1 w-1 rounded-full bg-current" />)}</span></button>
              )}
            </div>
            <h3 className="pr-8 text-xl font-bold tracking-tight">{product.name}</h3><p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{product.description}</p>
            <div className="mt-auto pt-6"><div className="flex items-end justify-between gap-4"><span className="text-2xl font-bold text-emerald-800">${product.price.toFixed(2)}</span><span className="text-xs uppercase tracking-wide text-slate-400">Product</span></div><div className="mt-4 flex min-h-6 flex-wrap gap-2">{product.categories.length > 0 ? product.categories.map((category) => <span key={category.id} className="border border-emerald-100 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">{category.name}</span>) : <span className="text-xs text-slate-400">Uncategorized</span>}</div></div>
          </article>)}</div>}
        </section>
        {isAdmin && activeProduct && ui.actionMenuPosition && <div id={`actions-${activeProduct.id}`} className="fixed z-50 min-w-32 border border-slate-200 bg-white p-1 shadow-lg" style={ui.actionMenuPosition}><button type="button" className="block w-full px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-emerald-700" onClick={() => openEditProduct(activeProduct)}>Edit</button><button type="button" className="block w-full px-3 py-2 text-left text-sm font-bold text-red-700 hover:bg-red-50 hover:text-red-900" onClick={() => void handleDelete(activeProduct.id)} disabled={ui.deletingId === activeProduct.id}>{ui.deletingId === activeProduct.id ? "Deleting..." : "Delete"}</button></div>}
        {isAdmin && ui.isModalOpen && <div className="fixed inset-0 z-10 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !ui.submitting) setUi((current) => ({ ...current, isModalOpen: false })); }}><section className="w-full max-w-md bg-white p-7 shadow-2xl" role="dialog" aria-modal="true"><div className="mb-7 flex items-center justify-between gap-6"><h2 className="text-2xl font-bold tracking-tight">{form.editingId === null ? "Add product" : "Edit product"}</h2><button type="button" className="p-1 text-2xl leading-none text-slate-400 hover:text-slate-700" onClick={() => setUi((current) => ({ ...current, isModalOpen: false }))} disabled={ui.submitting}>×</button></div><form onSubmit={handleSubmit}><label className="mb-5 grid gap-2 text-sm font-bold"><span>Name</span><input className="border border-slate-200 bg-slate-50 px-3 py-3 font-normal outline-none focus:border-[#26a699] focus:ring-2 focus:ring-emerald-700/15" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Name" autoFocus required /></label><label className="mb-5 grid gap-2 text-sm font-bold"><span>Description</span><textarea className="min-h-24 border border-slate-200 bg-slate-50 px-3 py-3 font-normal outline-none focus:border-[#26a699] focus:ring-2 focus:ring-emerald-700/15" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description" required /></label><label className="mb-5 grid gap-2 text-sm font-bold"><span>Price</span><input type="number" step="0.01" min="0" className="border border-slate-200 bg-slate-50 px-3 py-3 font-normal outline-none focus:border-[#26a699] focus:ring-2 focus:ring-emerald-700/15" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} placeholder="0.00" required /></label><fieldset className="mb-5"><legend className="mb-2 text-sm font-bold">Categories</legend>{categories.length === 0 ? <p className="border border-dashed border-slate-300 p-3 text-sm text-slate-500">No categories yet. Add one from the Categories page.</p> : <div className="grid max-h-36 gap-2 overflow-y-auto border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">{categories.map((category) => <label key={category.id} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.categoryIds.includes(category.id)} onChange={(event) => setForm((current) => ({ ...current, categoryIds: event.target.checked ? [...current.categoryIds, category.id] : current.categoryIds.filter((id) => id !== category.id) }))} />{category.name}</label>)}</div>}</fieldset>{status.error && <p className="mt-5 text-sm text-red-700" role="alert">{status.error}</p>}<div className="mt-7 flex justify-end gap-3"><button type="button" className="bg-slate-100 px-5 py-3 font-bold text-slate-900 hover:bg-slate-200" onClick={() => setUi((current) => ({ ...current, isModalOpen: false }))} disabled={ui.submitting}>Cancel</button><button type="submit" className="bg-black px-5 py-3 font-bold text-white hover:bg-[#26a699]" disabled={ui.submitting}>{ui.submitting ? (form.editingId === null ? "Adding..." : "Updating...") : form.editingId === null ? "Add product" : "Update product"}</button></div></form></section></div>}
      </div>
    </main>
  );
}
