"use client";

import { useState } from "react";

export function PasswordField({
  autoComplete,
  className = "",
  minLength,
}: {
  autoComplete: "current-password" | "new-password";
  className?: string;
  minLength?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <label
      className={`flex flex-col gap-2 text-sm font-semibold text-[#d6d6d6] ${className}`}
    >
      Password
      <span className="flex h-14 rounded-full border border-[#333] bg-[#161616] transition focus-within:border-[#f4f4f4]">
        <input
          className="min-w-0 flex-1 bg-transparent px-5 text-base text-white outline-none"
          name="password"
          type={isVisible ? "text" : "password"}
          minLength={minLength}
          autoComplete={autoComplete}
          required
        />
        <button
          className="px-5 text-xs font-semibold text-[#b8b8b8] transition hover:text-white"
          type="button"
          aria-pressed={isVisible}
          aria-label={isVisible ? "Hide password" : "Show password"}
          onClick={() => setIsVisible((current) => !current)}
        >
          {isVisible ? "Hide" : "Show"}
        </button>
      </span>
    </label>
  );
}
