import Link from "next/link";
import { signOut } from "../../lib/auth";

export function ChatSidebar({ email }: { email?: string | null }) {
  return (
    <aside className="border-b-4 border-[#1C1B1A] bg-[#E7E1D6] p-4 text-[#1C1B1A] shadow-[0_12px_0_#1C1B1A] lg:sticky lg:top-0 lg:h-screen lg:w-[280px] lg:self-start lg:overflow-y-auto lg:border-b-0 lg:border-r-4 lg:shadow-[12px_0_0_#1C1B1A]">
      <div className="flex min-h-full flex-col gap-5">
        <div>
          <Link
            href="/"
            className="inline-block border-4 border-[#1C1B1A] bg-[#C89B3C] px-3 py-2 text-lg font-black uppercase leading-none tracking-tighter shadow-[6px_6px_0_#8E3A3A]"
          >
            Knowledge Assistant
          </Link>
          <p className="mt-5 inline-block -skew-x-6 bg-[#8E3A3A] px-3 py-1 text-xs font-black uppercase tracking-[0.24em] text-white shadow-[5px_5px_0_#1C1B1A]">
            Mission Control
          </p>
          <h1 className="mt-3 text-4xl font-black uppercase leading-none text-[#C89B3C] drop-shadow-[4px_4px_0_#1C1B1A]">
            Chat Console
          </h1>
        </div>

        <nav className="grid gap-3">
          <Link
            className="comic-impact border-2 border-[#1C1B1A] bg-white px-4 py-3 text-sm font-black uppercase tracking-wider shadow-[5px_5px_0_#4F6F86]"
            href="/"
          >
            Home
          </Link>
          <Link
            className="comic-impact border-2 border-[#1C1B1A] bg-white px-4 py-3 text-sm font-black uppercase tracking-wider shadow-[5px_5px_0_#4F6F86]"
            href="/upload"
          >
            Upload
          </Link>
          <Link
            className="comic-impact border-2 border-[#1C1B1A] bg-[#1C1B1A] px-4 py-3 text-sm font-black uppercase tracking-wider text-white shadow-[5px_5px_0_#4F6F86]"
            href="/chat"
          >
            Chat
          </Link>
        </nav>

        <div className="mt-auto border-4 border-[#1C1B1A] bg-white p-3 shadow-[7px_7px_0_#1C1B1A]">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-[#8E3A3A]">
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
          <button className="comic-impact w-full border-2 border-[#1C1B1A] bg-[#8E3A3A] px-4 py-3 text-sm font-black uppercase tracking-wider text-white shadow-[5px_5px_0_#1C1B1A]">
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  );
}
