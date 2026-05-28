import Link from "next/link";
import { signOut } from "../../lib/auth";

export function ChatSidebar({
  active = "chat",
  email,
}: {
  active?: "chat" | "upload";
  email?: string | null;
}) {
  return (
    <aside className="border-b border-[#111] bg-[#050505] p-3 text-white lg:sticky lg:top-0 lg:h-screen lg:w-[264px] lg:self-start lg:overflow-y-auto lg:border-b-0 lg:border-r">
      <div className="flex min-h-full flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-full border border-[#2b2b2b] text-base">
              K
            </span>
            <span>Knowledge</span>
          </Link>
          <Link
            href="/"
            className="rounded-full px-2 py-1 text-sm font-semibold leading-none text-[#9b9b9b] transition hover:bg-[#1b1b1b] hover:text-white"
            title="Back to landing"
          >
            &lt;&lt;
          </Link>
        </div>

        <nav className="grid gap-1 text-sm font-semibold">
          {active === "upload" ? (
            <Link
              className="rounded-xl px-3 py-2 text-[#d0d0d0] transition hover:bg-[#191919] hover:text-white"
              href="/chat"
            >
              New Chat
            </Link>
          ) : null}
          <Link
            className={`rounded-xl px-3 py-2 transition ${
              active === "upload"
                ? "bg-[#1d1d1d] text-white"
                : "text-[#d0d0d0] hover:bg-[#191919] hover:text-white"
            }`}
            href="/upload"
          >
            Upload
          </Link>
        </nav>

        <div className="grid gap-3 text-sm">
          <div>
            <div className="mb-2 text-xs font-semibold text-white">Projects</div>
            <Link
              href="/upload"
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-[#9b9b9b] transition hover:bg-[#191919] hover:text-white"
            >
              <span className="text-xl leading-none">+</span>
              <span>New Project</span>
            </Link>
          </div>
          <div className={active === "chat" ? "mt-14" : ""}>
            <div className="mb-2 text-xs font-semibold text-white">History</div>
            <p className="rounded-xl px-3 py-2 text-xs leading-5 text-[#8d8d8d]">
              Your saved chats appear in the center panel after you start asking.
            </p>
          </div>
        </div>

        <div className="mt-auto rounded-2xl border border-[#171717] bg-[#080808] p-3">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#8d8d8d]">
            Account
          </p>
          <p className="mt-2 break-all text-sm font-semibold text-white">{email}</p>
        </div>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login?status=logged-out" });
          }}
        >
          <button className="w-full rounded-full border border-[#2a2a2a] px-4 py-3 text-sm font-semibold text-[#d0d0d0] transition hover:border-[#555] hover:text-white">
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  );
}
