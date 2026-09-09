"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Student = { id: number; name: string; score: number };
type SortKey = keyof Student;
type ConnectionStatus = "checking" | "online" | "offline";
const API_URL = "http://127.0.0.1:8000";

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [form, setForm] = useState({ name: "", score: "", editingId: null as number | null });
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

  async function loadStudents(showLoading = false) {
    try {
      if (showLoading) setUi((s) => ({ ...s, loading: true }));
      const response = await fetch(`${API_URL}/students`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load students.");
      setStudents(await response.json());
      setStatus({ connection: "online", error: "" });
    } catch (err) {
      setStatus((s) => ({
        ...s,
        connection: "offline",
        error: showLoading && err instanceof Error ? err.message : "Could not load students.",
      }));
    } finally {
      setUi((s) => ({ ...s, loading: false }));
    }
  }

  useEffect(() => {
    void loadStudents(true);
    const refreshTimer = window.setInterval(() => void loadStudents(), 5000);
    return () => window.clearInterval(refreshTimer);
  }, []);

  useEffect(() => {
    if (!ui.isModalOpen && ui.actionMenuId === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !ui.submitting) {
        setUi((s) => ({ ...s, isModalOpen: false, actionMenuId: null, actionMenuPosition: null }));
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
      const buttonBounds = button.getBoundingClientRect();
      const menuHeight = 88;
      setUi((s) => ({
        ...s,
        actionMenuPosition: {
          top: buttonBounds.bottom + 4 > window.innerHeight - menuHeight
            ? buttonBounds.top - menuHeight - 4
            : buttonBounds.bottom + 4,
          right: window.innerWidth - buttonBounds.right,
        },
      }));
    };
    updatePosition();
    const listeners = () => updatePosition();
    window.addEventListener("resize", listeners);
    window.addEventListener("scroll", listeners, true);
    return () => {
      window.removeEventListener("resize", listeners);
      window.removeEventListener("scroll", listeners, true);
    };
  }, [ui.actionMenuId]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const isEditing = form.editingId !== null;
    const studentId = form.editingId ?? (students.length ? Math.max(...students.map((s) => s.id)) + 1 : 1);
    try {
      setUi((s) => ({ ...s, submitting: true }));
      setStatus({ connection: "online", error: "" });
      const res = await fetch(`${API_URL}/students${isEditing ? `/${studentId}` : ""}`, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: studentId, name: form.name.trim(), score: Number(form.score) }),
      });
      if (!res.ok) {
        const details = await res.json().catch(() => null);
        throw new Error(details?.detail ?? `Could not ${isEditing ? "update" : "add"} student.`);
      }
      const saved = await res.json();
      setStudents((s) => isEditing ? s.map((st) => st.id === saved.id ? saved : st) : [...s, saved]);
      setForm({ name: "", score: "", editingId: null });
      setUi((s) => ({ ...s, isModalOpen: false }));
    } catch (err) {
      setStatus({
        connection: "offline",
        error: err instanceof Error ? err.message : `Could not ${isEditing ? "update" : "add"} student.`,
      });
    } finally {
      setUi((s) => ({ ...s, submitting: false }));
    }
  }

  const openAddStudent = () => {
    setForm({ name: "", score: "", editingId: null });
    setUi((s) => ({ ...s, isModalOpen: true, actionMenuId: null, actionMenuPosition: null }));
    setStatus({ connection: "online", error: "" });
  };

  const openEditStudent = (student: Student) => {
    setForm({ name: student.name, score: String(student.score), editingId: student.id });
    setUi((s) => ({ ...s, isModalOpen: true, actionMenuId: null, actionMenuPosition: null }));
    setStatus({ connection: "online", error: "" });
  };

  const handleDelete = async (id: number) => {
    try {
      setUi((s) => ({ ...s, actionMenuId: null, actionMenuPosition: null, deletingId: id }));
      setStatus({ connection: "online", error: "" });
      const res = await fetch(`${API_URL}/students/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const details = await res.json().catch(() => null);
        throw new Error(details?.detail ?? "Could not delete student.");
      }
      setStudents((s) => s.filter((st) => st.id !== id));
    } catch (err) {
      setStatus({
        connection: "offline",
        error: err instanceof Error ? err.message : "Could not delete student.",
      });
    } finally {
      setUi((s) => ({ ...s, deletingId: null }));
    }
  };

  const toggleActionMenu = (id: number) => {
    setUi((s) => ({
      ...s,
      actionMenuId: s.actionMenuId === id ? null : id,
      actionMenuPosition: s.actionMenuId === id ? null : s.actionMenuPosition,
    }));
  };

  const handleSort = (key: SortKey) => {
    setUi((s) => ({
      ...s,
      sortKey: key,
      sortAscending: s.sortKey === key ? !s.sortAscending : true,
    }));
  };

  const sorted = [...students].sort((a, b) => {
    const aVal = a[ui.sortKey];
    const bVal = b[ui.sortKey];
    const cmp = typeof aVal === "string" ? aVal.localeCompare(String(bVal)) : Number(aVal) - Number(bVal);
    return ui.sortAscending ? cmp : -cmp;
  });

  const statusColors = {
    online: "border-emerald-200 text-emerald-800 bg-emerald-50",
    offline: "border-red-200 text-red-800 bg-red-50",
    checking: "border-slate-200 text-slate-600 bg-slate-50",
  };
  const dotColors = {
    online: "bg-emerald-600",
    offline: "bg-red-600",
    checking: "bg-slate-400",
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 font-sans text-slate-900 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <section className="mt-8 border border-slate-200 bg-white p-5 sm:p-7">
          <div className="flex items-center justify-between gap-6 mb-6">
            <h2 className="text-2xl font-bold tracking-tight">Student list</h2>
            <span className="text-sm text-slate-500">{students.length} {students.length === 1 ? "student" : "students"}</span>
          </div>
          <div className={`flex items-center gap-2 border px-3 py-2 text-sm ${statusColors[status.connection]}`} role="status">
            <span className={`h-2 w-2 rounded-full ${dotColors[status.connection]}`} aria-hidden="true" />
            <span>{status.connection === "online" ? "online" : status.connection === "offline" ? "offline" : "Connecting..."}</span>
            {status.connection === "offline" && <button type="button" className="ml-auto font-bold underline" onClick={() => void loadStudents(true)}>Retry</button>}
          </div>
          {status.error && <p className="mt-4 text-sm text-red-700" role="alert">{status.error}</p>}
          {ui.loading ? (
            <p className="mt-6 text-slate-500">Loading...</p>
          ) : students.length === 0 ? (
            <p className="mt-6 text-slate-500">No students.</p>
          ) : (
            <div className="mt-6 overflow-y-auto">
              <table className="w-full min-w-140 border-collapse text-left text-sm">
                <thead>
                  <tr className="border-y border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    {(["id", "name", "score"] as const).map((col) => (
                      <th key={col} className="px-3 py-3 font-bold first:pl-0">
                        <button type="button" className="flex items-center gap-2 font-bold hover:text-emerald-700" onClick={() => handleSort(col)} aria-label={`${ui.sortKey === col ? (ui.sortAscending ? "Sorted ascending" : "Sorted descending") : "Sort"} by ${col}`}>
                          {col}<span aria-hidden="true">{ui.sortKey === col ? (ui.sortAscending ? "↑" : "↓") : "↕"}</span>
                        </button>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-right last:pr-0">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-4 font-mono text-slate-500 first:pl-0">{s.id}</td>
                      <td className="px-3 py-4 font-semibold">{s.name}</td>
                      <td className="px-3 py-4">{s.score}</td>
                      <td className="px-3 py-4 text-right last:pr-0">
                        <button
                          type="button"
                          ref={(btn) => { actionButtonRefs.current[s.id] = btn; }}
                          className="inline-flex h-9 w-9 items-center justify-center border border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                          onClick={() => toggleActionMenu(s.id)}
                          aria-expanded={ui.actionMenuId === s.id}
                          aria-controls={`actions-${s.id}`}
                        >
                          <span className="flex flex-col gap-1" aria-hidden="true">
                            {[1, 2, 3].map((i) => <span key={i} className="h-1 w-1 rounded-full bg-current" />)}
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {ui.actionMenuId && ui.actionMenuPosition && (() => {
          const s = students.find((st) => st.id === ui.actionMenuId);
          return s ? (
            <div id={`actions-${s.id}`} className="fixed z-50 min-w-32 border border-slate-200 bg-white p-1 shadow-lg" style={ui.actionMenuPosition}>
              <button type="button" className="block w-full px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-emerald-700" onClick={() => openEditStudent(s)}>Edit</button>
              <button type="button" className="block w-full px-3 py-2 text-left text-sm font-bold text-red-700 hover:bg-red-50 hover:text-red-900" onClick={() => void handleDelete(s.id)} disabled={ui.deletingId === s.id}>{ui.deletingId === s.id ? "Deleting..." : "Delete"}</button>
            </div>
          ) : null;
        })()}
        <button type="button" className="mt-6 w-full bg-black px-5 py-3 font-bold text-white hover:bg-[#26a699] sm:w-auto" onClick={openAddStudent}>+ Add student</button>
        {ui.isModalOpen && (
          <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/50 p-5" onMouseDown={(e) => { if (e.target === e.currentTarget && !ui.submitting) setUi((s) => ({ ...s, isModalOpen: false })); }}>
            <section className="w-full max-w-md bg-white p-7 shadow-2xl" role="dialog" aria-modal="true">
              <div className="flex items-center justify-between gap-6 mb-7">
                <h2 className="text-2xl font-bold tracking-tight">{form.editingId === null ? "Add student" : "Edit student"}</h2>
                <button type="button" className="p-1 text-2xl leading-none text-slate-400 hover:text-slate-700" onClick={() => setUi((s) => ({ ...s, isModalOpen: false }))} disabled={ui.submitting}>×</button>
              </div>
              <form onSubmit={handleSubmit}>
                {["name", "score"].map((field) => (
                  <label key={field} className="mb-5 grid gap-2 text-sm font-bold">
                    <span className="capitalize">{field}</span>
                    <input className="border border-slate-200 bg-slate-50 px-3 py-3 font-normal outline-none focus:border-[#26a699] focus:ring-2 focus:ring-emerald-700/15" type={field === "score" ? "number" : "text"} value={form[field as keyof typeof form] as string} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} placeholder={field === "score" ? "0 - 100" : "Name"} {...(field === "score" ? { min: 0, max: 100 } : { autoFocus: true })} required />
                  </label>
                ))}
                {status.error && <p className="mt-5 text-sm text-red-700" role="alert">{status.error}</p>}
                <div className="mt-7 flex justify-end gap-3">
                  <button type="button" className="bg-slate-100 px-5 py-3 font-bold text-slate-900 hover:bg-slate-200" onClick={() => setUi((s) => ({ ...s, isModalOpen: false }))} disabled={ui.submitting}>Cancel</button>
                  <button type="submit" className="bg-black px-5 py-3 font-bold text-white hover:bg-[#26a699]" disabled={ui.submitting}>{ui.submitting ? (form.editingId === null ? "Adding..." : "Updating...") : form.editingId === null ? "Add student" : "Update student"}</button>
                </div>
              </form>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}