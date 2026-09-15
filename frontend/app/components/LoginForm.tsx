"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { login, register } from "../lib/auth";

type LoginFormProps = {
  onSuccess: () => void;
  onCancel?: () => void;
  mode?: "login" | "register";
  navigateOnModeSwitch?: boolean;
};

export default function LoginForm({
  onSuccess,
  onCancel,
  mode = "login",
  navigateOnModeSwitch = false,
}: LoginFormProps) {
  const [isRegister, setIsRegister] = useState(mode === "register");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const cleanUsername = username.trim();
    if (cleanUsername.length < 3) {
      setError("Username must be at least 3 characters long.");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters long.");
      return;
    }
    if (isRegister && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      if (isRegister) await register(cleanUsername, password);
      else await login(cleanUsername, password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
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
            placeholder="username"
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

        {isRegister && (
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Confirm Password
            </label>
            <input
              type="password"
              required
              minLength={4}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm normal-case tracking-normal text-[#111111] placeholder-slate-400 outline-none transition-all focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
            />
          </div>
        )}

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
          {navigateOnModeSwitch ? (
            <Link
              href={isRegister ? "/login" : "/register"}
              className="text-slate-500 transition-colors hover:text-[#009688]"
            >
              {isRegister ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
            </Link>
          ) : (
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
          )}
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
    </div>
  );
}