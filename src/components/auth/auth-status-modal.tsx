"use client";

import { useState } from "react";

type AuthStatus = "logged-in" | "logged-out" | "login-error" | "register-error";

const statusCopy: Record<
  AuthStatus,
  { title: string; message: string; accentClass: string }
> = {
  "logged-in": {
    title: "Access Granted",
    message: "Login complete. Your chat console is ready.",
    accentClass: "bg-[#4F6F86]",
  },
  "logged-out": {
    title: "Signed Out",
    message: "Logout complete. Your session has been closed.",
    accentClass: "bg-[#8E3A3A]",
  },
  "login-error": {
    title: "Access Denied",
    message: "Invalid email or password. Please try again.",
    accentClass: "bg-[#8E3A3A]",
  },
  "register-error": {
    title: "Registration Blocked",
    message: "Please check the form details and try again.",
    accentClass: "bg-[#8E3A3A]",
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

  if (!copy || !isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#1C1B1A]/70 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-status-title"
    >
      <div className="relative w-full max-w-sm border-4 border-[#1C1B1A] bg-white p-5 text-[#1C1B1A] shadow-[14px_14px_0_#C89B3C]">
        <div
          className={`absolute -right-3 -top-3 px-3 py-2 text-xs font-black uppercase tracking-[0.22em] text-white shadow-[5px_5px_0_#1C1B1A] ${copy.accentClass}`}
        >
          Status
        </div>
        <h2 id="auth-status-title" className="text-3xl font-black uppercase">
          {copy.title}
        </h2>
        <p className="mt-3 text-sm font-bold leading-6 text-[#34302B]">
          {detail || copy.message}
        </p>
        <button
          className="comic-impact mt-5 w-full border-2 border-[#1C1B1A] bg-[#C89B3C] px-4 py-3 text-sm font-black uppercase tracking-wider shadow-[5px_5px_0_#1C1B1A]"
          type="button"
          onClick={() => setIsOpen(false)}
        >
          Close
        </button>
      </div>
    </div>
  );
}
