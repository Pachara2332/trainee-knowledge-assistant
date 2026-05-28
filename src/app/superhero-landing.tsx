"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ThemeToggle } from "../components/theme-toggle";

export function SuperheroLanding({
  email,
  isAuthenticated,
}: {
  email?: string | null;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {
      return;
    }

    window.sessionStorage.setItem("landingPrompt", trimmedPrompt);

    if (isAuthenticated) {
      router.push("/chat");
      return;
    }

    setShowLoginPrompt(true);
  }

  return (
    <main className="assistant-grid relative min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/5 to-black/25 dark:via-white/[0.01] dark:to-black/35" />

      <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6">
        <Link className="text-lg font-semibold tracking-tight" href="/">
          Knowledge Assistant
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              <span className="hidden rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--muted)] md:inline-block">
                {email}
              </span>
              <Link
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold hover:opacity-90"
                href="/chat"
              >
                Open Chat
              </Link>
            </>
          ) : (
            <>
              <Link
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold hover:opacity-90"
                href="/login"
              >
                Sign in
              </Link>
              <Link
                className="rounded-full bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-[var(--background)] hover:opacity-90"
                href="/register"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-7xl flex-col items-center justify-center px-6">
        <div className="mb-6 text-center">
          <p className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Your Knowledge Assistant
          </p>
          <h1 className="mt-2 text-2xl text-[var(--muted)] sm:text-3xl">
            Ask from your trainee archive
          </h1>
        </div>

        <form
          className="w-full max-w-2xl rounded-[30px] border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[0_6px_36px_rgba(0,0,0,0.25)]"
          onSubmit={handleSubmit}
        >
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] text-sm text-[var(--muted)]">
              +
            </span>
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="h-9 w-full bg-transparent px-2 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
              placeholder="What do you want to know?"
            />
            <button
              className="rounded-full bg-[var(--foreground)] px-4 py-2 text-xs font-semibold text-[var(--background)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!prompt.trim()}
            >
              Ask
            </button>
          </div>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-[var(--muted)]">
          {isAuthenticated ? (
            <>
              <span>Ready to continue your conversation.</span>
              <Link className="underline underline-offset-4" href="/chat">
                Go to chat
              </Link>
            </>
          ) : (
            <>
              <span>Please sign in to start chatting.</span>
              <Link className="underline underline-offset-4" href="/login">
                Login
              </Link>
              <span>/</span>
              <Link className="underline underline-offset-4" href="/register">
                Sign up
              </Link>
            </>
          )}
        </div>
      </section>

      {showLoginPrompt ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="landing-auth-title"
        >
          <div className="w-full max-w-md rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--foreground)] shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
            <h2 id="landing-auth-title" className="text-2xl font-semibold">
              Log in to continue
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Your question is ready. Sign in or create an account to send it.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link
                className="rounded-full bg-[var(--foreground)] px-5 py-3 text-center text-sm font-semibold text-[var(--background)] transition hover:opacity-90"
                href="/login"
              >
                Log in
              </Link>
              <Link
                className="rounded-full border border-[var(--border)] px-5 py-3 text-center text-sm font-semibold transition hover:bg-white/5"
                href="/register"
              >
                Sign up
              </Link>
            </div>
            <button
              className="mt-4 w-full rounded-full border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--foreground)]"
              type="button"
              onClick={() => setShowLoginPrompt(false)}
            >
              Keep editing
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
