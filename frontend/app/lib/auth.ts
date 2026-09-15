export type AuthUser = {
  id: number;
  username: string;
  role: "admin" | "user" | string;
  is_active: boolean;
};

export const API_URL = "http://127.0.0.1:8000";

const TOKEN_KEY = "uniweb_auth_token";
const USER_KEY = "uniweb_auth_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data) as AuthUser;
  } catch {
    return null;
  }
}

export function saveAuth(token: string, user: AuthUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event("auth-changed"));
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event("auth-changed"));
}

export function isAdmin(): boolean {
  const user = getUser();
  return user?.role === "admin";
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.detail ?? "Login failed. Please check credentials.");
  }

  const data = await res.json();
  saveAuth(data.access_token, data.user);
  return data.user;
}

export async function register(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.detail ?? "Registration failed.");
  }

  // Auto-login after registration
  return login(username, password);
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init?.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}

export async function getUsers(): Promise<AuthUser[]> {
  const res = await authFetch(`${API_URL}/users`, { cache: "no-store" });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.detail ?? "Failed to fetch users.");
  }
  return res.json();
}

export async function createUser(data: {
  username: string;
  password: string;
  role?: string;
}): Promise<AuthUser> {
  const res = await authFetch(`${API_URL}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.detail ?? "Failed to create user.");
  }
  return res.json();
}

export async function updateUser(
  userId: number,
  data: { role?: string; is_active?: boolean; password?: string }
): Promise<AuthUser> {
  const res = await authFetch(`${API_URL}/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.detail ?? "Failed to update user.");
  }
  return res.json();
}

export async function deleteUser(userId: number): Promise<void> {
  const res = await authFetch(`${API_URL}/users/${userId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.detail ?? "Failed to delete user.");
  }
}

