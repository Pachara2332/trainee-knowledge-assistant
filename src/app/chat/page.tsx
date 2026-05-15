import { redirect } from "next/navigation";
import { AuthStatusModal } from "../../components/auth/auth-status-modal";
import { ChatSidebar } from "../../components/chat/chat-sidebar";
import { auth } from "../../lib/auth";
import { ChatClient } from "./chat-client";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { status } = await searchParams;

  return (
    <main className="relative h-screen overflow-hidden bg-[#18202B] text-white">
      <AuthStatusModal status={status} />
      <div className="pointer-events-none fixed inset-0 hero-city opacity-50" />
      <div className="pointer-events-none fixed inset-0 hero-noise opacity-80" />
      <div className="pointer-events-none fixed inset-0 hero-halftone opacity-30" />
      <div className="pointer-events-none fixed right-[-8rem] top-12 h-96 w-96 rounded-full bg-[#8E3A3A] opacity-30 blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-8rem] left-[-6rem] h-96 w-96 rounded-full bg-[#4F6F86] opacity-30 blur-3xl" />

      <div className="relative z-10 grid h-screen min-h-0 lg:grid-cols-[280px_minmax(0,1fr)]">
        <ChatSidebar email={session.user.email} />

        <section className="flex h-screen min-h-0 min-w-0 overflow-hidden p-4 sm:p-6">
          <ChatClient email={session.user.email} />
        </section>
      </div>
    </main>
  );
}
