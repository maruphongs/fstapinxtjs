"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Product = { id: number; name: string; price: number };
type Category = { id: number; name: string; products: Product[] };
const API_URL = "http://127.0.0.1:8000";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [actionMenuId, setActionMenuId] = useState<number | null>(null);
  const [actionMenuPosition, setActionMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const actionButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  async function loadCategories() {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/categories`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load categories.");
      setCategories(await response.json());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load categories.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCategories();
  }, []);

  useEffect(() => {
    if (editingId === null && !name && actionMenuId === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) {
        setEditingId(null);
        setName("");
        setActionMenuId(null);
        setActionMenuPosition(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actionMenuId, editingId, name, submitting]);

  useEffect(() => {
    if (actionMenuId === null) return;
    const updatePosition = () => {
      const button = actionButtonRefs.current[actionMenuId];
      if (!button) return;
      const bounds = button.getBoundingClientRect();
      const menuHeight = 88;
      setActionMenuPosition({
        top: bounds.bottom + 4 > window.innerHeight - menuHeight ? bounds.top - menuHeight - 4 : bounds.bottom + 4,
        right: window.innerWidth - bounds.right,
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [actionMenuId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const isCreating = editingId === null || editingId === -1;
    try {
      setSubmitting(true);
      const response = await fetch(`${API_URL}/categories${isCreating ? "" : `/${editingId}`}`, {
        method: isCreating ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => null);
        throw new Error(details?.detail ?? "Could not save category.");
      }
      setName("");
      setEditingId(null);
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save category.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(category: Category) {
    if (!window.confirm(`Delete ${category.name}?`)) return;
    try {
      setActionMenuId(null);
      setActionMenuPosition(null);
      const response = await fetch(`${API_URL}/categories/${category.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete category.");
      setCategories((current) => current.filter((item) => item.id !== category.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete category.");
    }
  }

  const openAddCategory = () => {
    setName("");
    setEditingId(-1);
    setError("");
    setActionMenuId(null);
    setActionMenuPosition(null);
  };

  const openEditCategory = (category: Category) => {
    setName(category.name);
    setEditingId(category.id);
    setError("");
    setActionMenuId(null);
    setActionMenuPosition(null);
  };

  const closeModal = () => {
    if (submitting) return;
    setName("");
    setEditingId(null);
    setError("");
  };

  const toggleActionMenu = (categoryId: number) => {
    setActionMenuId((current) => {
      const next = current === categoryId ? null : categoryId;
      if (next === null) setActionMenuPosition(null);
      return next;
    });
  };

  const activeCategory = categories.find((category) => category.id === actionMenuId);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 font-sans text-slate-900 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">Catalog</p>
          <h1 className="text-4xl font-bold tracking-tight">Categories</h1>
          <p className="mt-2 max-w-xl text-slate-600">Create and organize the labels used across your products.</p>
        </header>

        <section className="mb-8 flex items-center justify-between gap-5 border border-slate-200 bg-white p-5 sm:p-7">
          <div><h2 className="text-2xl font-bold tracking-tight">Category collection</h2><p className="mt-1 text-sm text-slate-500">{categories.length} {categories.length === 1 ? "category" : "categories"}</p></div>
          <button type="button" className="bg-black px-5 py-3 font-bold text-white hover:bg-[#26a699]" onClick={openAddCategory}>+ Add category</button>
        </section>

        {loading ? <p className="text-slate-500">Loading categories...</p> : categories.length === 0 ? <div className="border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><p className="font-bold">No categories yet.</p><p className="mt-1 text-sm text-slate-500">Create one above, then assign it to products.</p></div> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{categories.map((category) => <article key={category.id} className="border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"><div className="flex items-start justify-between gap-4"><div><span className="font-mono text-xs text-slate-400">#{String(category.id).padStart(3, "0")}</span><h2 className="mt-3 text-xl font-bold">{category.name}</h2></div><div className="flex items-start gap-2"><span className="bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">{category.products.length} {category.products.length === 1 ? "product" : "products"}</span><button type="button" ref={(button) => { actionButtonRefs.current[category.id] = button; }} className="inline-flex h-8 w-8 items-center justify-center border border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900" onClick={() => toggleActionMenu(category.id)} aria-expanded={actionMenuId === category.id} aria-controls={`category-actions-${category.id}`} aria-label={`Actions for ${category.name}`}><span className="flex flex-col gap-1" aria-hidden="true">{[1, 2, 3].map((item) => <span key={item} className="h-1 w-1 rounded-full bg-current" />)}</span></button></div></div><div className="mt-6 flex flex-wrap gap-2">{category.products.length === 0 ? <span className="text-sm text-slate-400">No products assigned</span> : category.products.map((product) => <span key={product.id} className="border border-slate-200 px-2 py-1 text-xs text-slate-600">{product.name}</span>)}</div></article>)}</div>}
        {activeCategory && actionMenuPosition && <div id={`category-actions-${activeCategory.id}`} className="fixed z-50 min-w-32 border border-slate-200 bg-white p-1 shadow-lg" style={actionMenuPosition}><button type="button" className="block w-full px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-emerald-700" onClick={() => openEditCategory(activeCategory)}>Edit</button><button type="button" className="block w-full px-3 py-2 text-left text-sm font-bold text-red-700 hover:bg-red-50 hover:text-red-900" onClick={() => void handleDelete(activeCategory)}>Delete</button></div>}
        {editingId !== null && <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/50 p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}><section className="w-full max-w-md bg-white p-7 shadow-2xl" role="dialog" aria-modal="true"><div className="mb-7 flex items-center justify-between gap-6"><h2 className="text-2xl font-bold tracking-tight">{editingId === -1 ? "Add category" : "Edit category"}</h2><button type="button" className="p-1 text-2xl leading-none text-slate-400 hover:text-slate-700" onClick={closeModal} disabled={submitting}>×</button></div><form onSubmit={handleSubmit}><label className="grid gap-2 text-sm font-bold"><span>Name</span><input className="border border-slate-200 bg-slate-50 px-3 py-3 font-normal outline-none focus:border-[#26a699] focus:ring-2 focus:ring-emerald-700/15" value={name} onChange={(event) => setName(event.target.value)} placeholder="Category name" autoFocus required /></label>{error && <p className="mt-5 text-sm text-red-700" role="alert">{error}</p>}<div className="mt-7 flex justify-end gap-3"><button type="button" className="bg-slate-100 px-5 py-3 font-bold text-slate-900 hover:bg-slate-200" onClick={closeModal} disabled={submitting}>Cancel</button><button type="submit" className="bg-black px-5 py-3 font-bold text-white hover:bg-[#26a699]" disabled={submitting}>{submitting ? "Saving..." : editingId === -1 ? "Add category" : "Update category"}</button></div></form></section></div>}
      </div>
    </main>
  );
}
