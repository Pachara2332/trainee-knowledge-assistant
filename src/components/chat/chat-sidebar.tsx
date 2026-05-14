import Link from "next/link";
import { signOut } from "../../lib/auth";

export function ChatSidebar({ email }: { email?: string | null }) {
  return (
    <aside className="border-b-4 border-[#111111] bg-[#E5E7EB] p-4 text-[#111111] shadow-[0_12px_0_#111111] lg:min-h-screen lg:border-b-0 lg:border-r-4 lg:shadow-[12px_0_0_#111111]">
      <div className="flex h-full flex-col gap-5">
        <div>
          <Link
            href="/"
            className="inline-block border-4 border-[#111111] bg-[#FBB829] px-3 py-2 text-lg font-black uppercase leading-none tracking-tighter shadow-[6px_6px_0_#B91C1C]"
          >
            Knowledge Assistant
          </Link>
          <p className="mt-5 inline-block -skew-x-6 bg-[#B91C1C] px-3 py-1 text-xs font-black uppercase tracking-[0.24em] text-white shadow-[5px_5px_0_#111111]">
            Mission Control
          </p>
          <h1 className="mt-3 text-4xl font-black uppercase leading-none text-[#FBB829] drop-shadow-[4px_4px_0_#111111]">
            Chat Console
          </h1>
        </div>

        <nav className="grid gap-3">
          <Link
            className="comic-impact border-2 border-[#111111] bg-white px-4 py-3 text-sm font-black uppercase tracking-wider shadow-[5px_5px_0_#2986CC]"
            href="/"
          >
            Home
          </Link>
          <Link
            className="comic-impact border-2 border-[#111111] bg-[#111111] px-4 py-3 text-sm font-black uppercase tracking-wider text-white shadow-[5px_5px_0_#2986CC]"
            href="/chat"
          >
            New Chat
          </Link>
        </nav>

        <div className="mt-auto border-4 border-[#111111] bg-white p-3 shadow-[7px_7px_0_#111111]">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-[#B91C1C]">
            Operator
          </p>
          <p className="mt-1 break-all text-sm font-black">{email}</p>
        </div>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button className="comic-impact w-full border-2 border-[#111111] bg-[#B91C1C] px-4 py-3 text-sm font-black uppercase tracking-wider text-white shadow-[5px_5px_0_#111111]">
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  );
}
