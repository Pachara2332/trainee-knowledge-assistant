"use client";

import { useEffect, useState } from "react";

type AuthStatus = "logged-in" | "logged-out" | "login-error" | "register-error";

const statusCopy: Record<
  AuthStatus,
  { title: string; message: string; toneClass: string }
> = {
  "logged-in": {
    title: "Signed in",
    message: "Your workspace is ready.",
    toneClass: "border-[#244d36] bg-[#102016] text-[#baf7cf]",
  },
  "logged-out": {
    title: "Signed Out",
    message: "Your session has been closed.",
    toneClass: "border-[#333] bg-[#151515] text-[#dcdcdc]",
  },
  "login-error": {
    title: "Unable to sign in",
    message: "Invalid email or password. Please try again.",
    toneClass: "border-[#5b2525] bg-[#2a1010] text-[#ffb4b4]",
  },
  "register-error": {
    title: "Unable to create account",
    message: "Please check the form details and try again.",
    toneClass: "border-[#5b2525] bg-[#2a1010] text-[#ffb4b4]",
  },
};

export function AuthStatusModal({
  status,
  detail,
}: {
  status?: string;
  detail?: string;
}) {
  const copy = status && status in statusCopy ? statusCopy[status as AuthStatus] : null;
  const [isOpen, setIsOpen] = useState(Boolean(copy));

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search) {
      const url = new URL(window.location.href);
      if (
        url.searchParams.has("status") ||
        url.searchParams.has("error") ||
        url.searchParams.has("detail")
      ) {
        url.searchParams.delete("status");
        url.searchParams.delete("error");
        url.searchParams.delete("detail");
        const nextUrl = url.pathname + url.search;
        window.history.replaceState({}, "", nextUrl);
      }
    }
  }, []);

  if (!copy || !isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-status-title"
    >
      <div className="w-full max-w-sm rounded-3xl border border-[#242424] bg-[#0b0b0b] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className={`mb-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${copy.toneClass}`}>
          Status
        </div>
        <h2 id="auth-status-title" className="text-2xl font-semibold tracking-tight">
          {copy.title}
        </h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-[#a8a8a8]">
          {detail || copy.message}
        </p>
        <button
          className="mt-5 w-full rounded-full border border-[#2a2a2a] bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#e8e8e8]"
          type="button"
          onClick={() => setIsOpen(false)}
        >
          Close
        </button>
      </div>
    </div>
  );
}
