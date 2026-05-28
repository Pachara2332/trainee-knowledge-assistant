import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../lib/auth";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/chat");
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#030303] text-white">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="grid h-9 w-9 place-items-center rounded-full border border-[#242424] text-sm font-semibold"
          aria-label="Knowledge Assistant home"
        >
          K
        </Link>

        <nav className="flex items-center gap-2 text-sm font-semibold">
          <Link
            className="rounded-full border border-[#252525] px-4 py-2 text-white transition hover:border-[#555]"
            href="/login"
          >
            Sign in
          </Link>
          <Link
            className="rounded-full bg-white px-4 py-2 text-black transition hover:bg-[#e8e8e8]"
            href="/register"
          >
            Sign up
          </Link>
        </nav>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center px-4 pb-20">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-full border border-[#303030] bg-[#0d0d0d] text-2xl font-semibold">
            K
          </span>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Knowledge
          </h1>
        </div>

        <form className="w-full max-w-[800px]" action="/login">
          <div className="flex h-[58px] items-center gap-2 rounded-full border border-[#282828] bg-[#171717] px-3 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
            <button
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-2xl leading-none text-[#d6d6d6] transition hover:bg-[#252525]"
              type="button"
              title="Attach file"
            >
              +
            </button>
            <input
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-[#8d8d8d]"
              placeholder="What do you want to know?"
              aria-label="Prompt"
            />
            <Link
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-base font-semibold text-black"
              href="/login"
              aria-label="Start"
            >
              &uarr;
            </Link>
          </div>
        </form>
      </section>

      <p className="pb-5 text-center text-xs font-semibold text-[#8d8d8d]">
        Sign in to save history, upload documents, and continue conversations.
      </p>
    </main>
  );
}
