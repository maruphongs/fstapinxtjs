"use client";

import { ReactNode, useState } from "react";
import LoginForm from "./LoginForm";

type LoginDialogProps = {
  children: ReactNode;
  className?: string;
};

export default function LoginDialog({ children, className }: LoginDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className={className}>
        {children}
      </button>
      {isOpen && (
        <div
          className="fixed inset-0 z-100 flex min-h-screen items-center justify-center overflow-y-auto"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <section
            className="my-auto w-full max-w-md rounded-xl border border-slate-200 bg-white p-7 text-[#111111] shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-dialog-title"
          >
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 id="login-dialog-title" className="text-xl font-bold">
                  Sign in
                </h2>
                <p className="mt-1 text-sm text-slate-500">Authenticate without leaving this page.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-2xl leading-none text-slate-400 transition-colors hover:text-[#111111]"
                aria-label="Close sign in"
              >
                ×
              </button>
            </div>
            <LoginForm onSuccess={() => setIsOpen(false)} onCancel={() => setIsOpen(false)} />
          </section>
        </div>
      )}
    </>
  );
}