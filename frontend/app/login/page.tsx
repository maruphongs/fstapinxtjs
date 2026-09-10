"use client";

import { useRouter } from "next/navigation";
import LoginForm from "../components/LoginForm";

export default function LoginPage() {
  const router = useRouter();

  return (
    <main className="flex-1 w-full min-h-[calc(100vh-65px)] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="text-center mb-6">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[#b9dce9] bg-[#eef8fb] text-[#009688]">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111111]">
            Authentication
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to manage products and categories
          </p>
        </div>

        <LoginForm onSuccess={() => router.push("/products")} />
      </div>
    </main>
  );
}
