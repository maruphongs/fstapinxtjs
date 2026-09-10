"use client";

import { FormEvent, useState } from "react";
import { login, register } from "../lib/auth";

type LoginFormProps = {
  onSuccess: () => void;
  onCancel?: () => void;
};

export default function LoginForm({ onSuccess, onCancel }: LoginFormProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isRegister) await register(username.trim(), password);
      else await login(username.trim(), password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickLogin(user: string, pass: string) {
    setError("");
    setLoading(true);
    try {
      await login(user, pass);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quick login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Username
          </label>
          <input
            type="text"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            placeholder="e.g. admin or user"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm normal-case tracking-normal text-[#111111] placeholder-slate-400 outline-none transition-all focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={isRegister ? "new-password" : "current-password"}
            placeholder="••••••••"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm normal-case tracking-normal text-[#111111] placeholder-slate-400 outline-none transition-all focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#111111] px-4 py-2.5 text-sm font-medium text-white shadow-md transition-colors hover:bg-[#009688] disabled:opacity-50"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          ) : isRegister ? (
            "Create Account"
          ) : (
            "Sign In"
          )}
        </button>

        <div className="flex items-center justify-between text-xs pt-1">
          <button
            type="button"
            onClick={() => {
              setIsRegister((current) => !current);
              setError("");
            }}
            className="text-slate-500 transition-colors hover:text-[#009688]"
          >
            {isRegister ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-slate-500 transition-colors hover:text-[#111111]"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Quick Demo Login */}
      <div className="mt-6 border-t border-slate-200 pt-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center mb-2.5">
          Quick Demo Login
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleQuickLogin("admin", "1234")}
            className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-center text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100"
          >
            <div className="font-bold">🔑 Admin</div>
            <div className="text-[10px] text-amber-400/80">admin / 1234</div>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleQuickLogin("user", "1234")}
            className="rounded-xl border border-[#b9dce9] bg-[#eef8fb] p-2 text-center text-xs font-medium text-[#0b6f91] transition-colors hover:bg-[#dff2f7]"
          >
            <div className="font-bold">👁️ Viewer</div>
            <div className="text-[10px] text-blue-400/80">user / 1234</div>
          </button>
        </div>
      </div>
    </div>
  );
}