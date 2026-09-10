"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthUser, clearAuth, getUser } from "../lib/auth";

export default function Navbar() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setUser(getUser());

    const handleAuthChange = () => {
      setUser(getUser());
    };

    window.addEventListener("auth-changed", handleAuthChange);
    return () => window.removeEventListener("auth-changed", handleAuthChange);
  }, []);

  const handleLogout = () => {
    clearAuth();
    router.refresh();
  };

  return (
    <nav className="sticky top-0 z-50 flex w-full items-center justify-between border-b bg-black px-6 py-3 text-white">
      <div className="flex items-center space-x-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight transition-colors hover:text-[#009688]">
          <span className="inline-block h-3 w-3 rounded-full bg-[#009688] shadow-[0_0_0_4px_rgba(0,150,136,0.12)]"></span>
        </Link>
        <div className="flex items-center space-x-1">
          <Link
            href="/products"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              pathname === "/products" ? "bg-black text-white" : "text-white hover:text-[#009688]"
            }`}
          >
            Products
          </Link>
          <Link
            href="/categories"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              pathname === "/categories" ? "bg-black text-white" : "text-white hover:text-[#009688]"
            }`}
          >
            Categories
          </Link>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {user ? (
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-1">
              <span className="text-xs font-semibold text-white">@{user.username}</span>
            </div>
            <button
              onClick={handleLogout}
              className="px-2.5 py-1.5 text-xs text-white transition-colors hover:text-[#009688]"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <span className="hidden text-xs text-white sm:inline-block"></span>
            <Link
              href="/login"
              className="px-3.5 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:text-[#009688]"
            >
              Sign in
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}

