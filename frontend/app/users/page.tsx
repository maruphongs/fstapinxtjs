"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AuthUser,
  createUser,
  deleteUser,
  getUser,
  getUsers,
  updateUser,
} from "../lib/auth";

type ConnectionStatus = "checking" | "online" | "offline";

export default function UsersPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [status, setStatus] = useState<{ connection: ConnectionStatus; error: string }>({
    connection: "checking",
    error: "",
  });

  // Modal State for adding new user (admin)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"user" | "admin">("user");
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  // Action status / in-flight states
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    setCurrentUser(getUser());
    const handleAuthChange = () => setCurrentUser(getUser());
    window.addEventListener("auth-changed", handleAuthChange);
    return () => window.removeEventListener("auth-changed", handleAuthChange);
  }, []);

  async function loadUsers(showLoading = false) {
    try {
      if (showLoading) setLoading(true);
      const data = await getUsers();
      setUsers(data);
      setStatus({ connection: "online", error: "" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not load users.";
      setStatus({ connection: "offline", error: msg });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers(true);
  }, [currentUser]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch = u.username.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role === "admin").length;
    const active = users.filter((u) => u.is_active).length;
    return { total, admins, active };
  }, [users]);

  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setModalError("");
    setModalSubmitting(true);
    try {
      await createUser({
        username: newUsername.trim(),
        password: newPassword,
        role: newRole,
      });
      setIsAddModalOpen(false);
      setNewUsername("");
      setNewPassword("");
      setNewRole("user");
      await loadUsers();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to create user.");
    } finally {
      setModalSubmitting(false);
    }
  }

  async function handleToggleStatus(targetUser: AuthUser) {
    if (!isAdmin || actionLoadingId !== null) return;
    setActionLoadingId(targetUser.id);
    try {
      await updateUser(targetUser.id, { is_active: !targetUser.is_active });
      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update user status.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleToggleRole(targetUser: AuthUser) {
    if (!isAdmin || actionLoadingId !== null) return;
    const newRoleValue = targetUser.role === "admin" ? "user" : "admin";
    setActionLoadingId(targetUser.id);
    try {
      await updateUser(targetUser.id, { role: newRoleValue });
      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update user role.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDeleteUser(targetUserId: number) {
    if (!isAdmin || actionLoadingId !== null) return;
    setActionLoadingId(targetUserId);
    try {
      await deleteUser(targetUserId);
      setDeleteConfirmId(null);
      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete user.");
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-white px-4 py-10 font-sans text-slate-900 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-teal-700">Catalog</p>
          <h1 className="text-4xl font-bold tracking-tight">Users</h1>
          <p className="mt-2 max-w-xl text-slate-600">Manage registered access and privileges across your application.</p>
        </header>

        <section className="mb-8 flex flex-col justify-between gap-5 border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:p-7">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">User collection</h2>
            <p className="mt-1 text-sm text-slate-500">{stats.total} {stats.total === 1 ? "user" : "users"}</p>
          </div>
          {isAdmin ? (
            <button
              type="button"
              className="bg-[#111111] px-5 py-3 font-bold text-white shadow-md transition hover:bg-[#009688]"
              onClick={() => {
                setModalError("");
                setIsAddModalOpen(true);
              }}
            >
              + Add user
            </button>
          ) : null}
        </section>

        {status.error && <p className="mb-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{status.error}</p>}

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users by username..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/15"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500">Role:</label>
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setRoleFilter("all")}
                className={`rounded-md px-3 py-1.5 font-medium transition ${roleFilter === "all" ? "bg-black text-white" : "text-slate-600 hover:text-black"}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("admin")}
                className={`rounded-md px-3 py-1.5 font-medium transition ${roleFilter === "admin" ? "bg-black text-white" : "text-slate-600 hover:text-black"}`}
              >
                Admins
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("user")}
                className={`rounded-md px-3 py-1.5 font-medium transition ${roleFilter === "user" ? "bg-black text-white" : "text-slate-600 hover:text-black"}`}
              >
                Users
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#009688] border-t-transparent"></div>
              <p className="mt-3 text-xs text-slate-500">Loading user accounts...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-medium text-slate-600">No users found</p>
              <p className="mt-1 text-xs text-slate-400">
                {searchQuery ? "Try a different search term." : "No registered accounts available."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3">User</th>
                    <th className="px-5 py-3">Role</th>
                    {isAdmin && <th className="px-5 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredUsers.map((u) => {
                    const isCurrent = currentUser?.id === u.id;
                    const isLoading = actionLoadingId === u.id;

                    return (
                      <tr key={u.id} className="transition-colors hover:bg-slate-50/60">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ${u.role === "admin"
                                ? "bg-teal-500"
                                : "bg-slate-500"}`}
                            >
                              {u.username.slice(0, 3).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900">{u.username}</span>
                                {isCurrent && (
                                  <span className="rounded border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[10px] font-medium text-[#009688]">
                                    You
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400">ID #{u.id}</span>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {u.role === "admin" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-teal-300">
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                              <svg className="h-3 w-3 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              User
                            </span>
                          )}
                        </td>

                        {isAdmin && (
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleRole(u)}
                                disabled={isLoading || isCurrent}
                                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                                title={
                                  isCurrent
                                    ? "Cannot change your own role"
                                    : u.role === "admin"
                                      ? "Demote to User"
                                      : "Promote to Admin"
                                }
                              >
                                {u.role === "admin" ? "Demote" : "Make Admin"}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleStatus(u)}
                                disabled={isLoading || isCurrent}
                                className={`rounded-md border px-2 py-1 text-[11px] font-medium disabled:opacity-40 ${u.is_active
                                  ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
                                title={isCurrent ? "Cannot deactivate yourself" : undefined}
                              >
                                {u.is_active ? "Disable" : "Enable"}
                              </button>

                              {deleteConfirmId === u.id ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(u.id)}
                                    disabled={isLoading}
                                    className="rounded-md bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-50"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(u.id)}
                                  disabled={isLoading || isCurrent}
                                  className="rounded-md border border-slate-200 bg-white p-1 text-slate-400 hover:border-rose-200 hover:text-rose-600 disabled:opacity-40"
                                  title={isCurrent ? "Cannot delete yourself" : "Delete user"}
                                >
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Admin Add User Modal */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsAddModalOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#111111]">Register New User</h3>
                <p className="text-xs text-slate-500">Create an account with specific privileges.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-2xl text-slate-400 hover:text-black leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Username
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. alexander"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-[#111111] outline-none focus:border-[#009688] focus:ring-1 focus:ring-[#009688]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 4 characters"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-[#111111] outline-none focus:border-[#009688] focus:ring-1 focus:ring-[#009688]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as "user" | "admin")}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-[#111111] outline-none focus:border-[#009688] focus:ring-1 focus:ring-[#009688]"
                >
                  <option value="user">User / Viewer (Read-only)</option>
                  <option value="admin">Administrator (Full Access)</option>
                </select>
              </div>

              {modalError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-xs">
                  {modalError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="rounded-lg bg-[#009688] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#00796b] disabled:opacity-50"
                >
                  {modalSubmitting ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
