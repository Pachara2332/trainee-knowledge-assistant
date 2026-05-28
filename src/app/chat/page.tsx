import { redirect } from "next/navigation";
import { AuthStatusModal } from "../../components/auth/auth-status-modal";
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
    <main className="relative h-screen overflow-hidden bg-[#050505] text-white">
      <AuthStatusModal status={status} />
      <ChatClient
        email={session.user.email}
        name={session.user.name}
        image={session.user.image}
      />
    </main>
  );
}
