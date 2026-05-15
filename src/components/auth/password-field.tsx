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
      className={`flex flex-col gap-2 text-sm font-black uppercase tracking-wider ${className}`}
    >
      Password
      <span className="flex h-12 border-2 border-[#1C1B1A] bg-[#E7E1D6] transition focus-within:bg-white focus-within:shadow-[5px_5px_0_#4F6F86]">
        <input
          className="min-w-0 flex-1 bg-transparent px-3 text-base font-semibold outline-none"
          name="password"
          type={isVisible ? "text" : "password"}
          minLength={minLength}
          autoComplete={autoComplete}
          required
        />
        <button
          className="border-l-2 border-[#1C1B1A] bg-white px-3 text-xs font-black uppercase tracking-wider text-[#1C1B1A] transition hover:bg-[#C89B3C]"
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
