import { redirect } from "next/navigation";
import { ChatSidebar } from "../../components/chat/chat-sidebar";
import { auth } from "../../lib/auth";
import { ChatClient } from "./chat-client";

export default async function ChatPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0F172A] text-white">
      <div className="pointer-events-none fixed inset-0 hero-city opacity-50" />
      <div className="pointer-events-none fixed inset-0 hero-noise opacity-80" />
      <div className="pointer-events-none fixed inset-0 hero-halftone opacity-30" />
      <div className="pointer-events-none fixed right-[-8rem] top-12 h-96 w-96 rounded-full bg-[#B91C1C] opacity-30 blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-8rem] left-[-6rem] h-96 w-96 rounded-full bg-[#2986CC] opacity-30 blur-3xl" />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-[280px_1fr]">
        <ChatSidebar email={session.user.email} />

        <section className="flex min-h-0 p-4 sm:p-6">
          <ChatClient email={session.user.email} />
        </section>
      </div>
    </main>
  );
}
