"use client";

import { useRouter } from "next/navigation";
import LoginForm from "../components/LoginForm";

export default function RegisterPage() {
  const router = useRouter();

  return (
    <main className="flex-1 w-full min-h-[calc(100vh-65px)] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#111111]">
            Create an Account
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign up
          </p>
        </div>

        <LoginForm
          mode="register"
          navigateOnModeSwitch
          onSuccess={() => router.push("/products")}
        />
      </div>
    </main>
  );
}
