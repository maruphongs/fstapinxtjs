"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthUser, clearAuth, getUser } from "../lib/auth";

const style = {
  link: "flex justify-center items-center h-full w-full hover:text-teal-500 hover:bg-linear-to-t from-teal-500 via-transparent to-transparent group relative",
  underline: "w-full absolute bottom-0 left-0 bg-teal-500 group-hover:pt-64 group-hover:opacity-10 transition-all"
};

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
      <div className="flex items-center space-x-6 ">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-teal-500"></span>
        </Link>
        <div className="flex items-center space-x-1 sm:px-4 group relative">
          <Link
            href="/products"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${pathname === "/products" ? "bg-black text-white" : "text-white hover:text-teal-500"
              }`}
          >
            Products
          </Link>
          <Link
            href="/categories"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${pathname === "/categories" ? "bg-black text-white" : "text-white hover:text-teal-500"
              }`}
          >
            Categories
          </Link>
          <Link
            href="/users"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${pathname === "/users" ? "bg-black text-white" : "text-white hover:text-teal-500"
              }`}
          >
            Users
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
              className="px-2.5 py-1.5 text-xs text-white transition-colors hover:text-teal-500"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <Link
              href="/login"
              className="px-3 py-1.5 text-xs font-medium text-white transition-colors hover:text-teal-500"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-teal-500 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-teal-600"
            >
              Register
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}

