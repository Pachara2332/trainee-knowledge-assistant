import { redirect } from "next/navigation";
import { AuthStatusModal } from "../../components/auth/auth-status-modal";
import { auth } from "../../lib/auth";
import { AgentClient } from "./agent-client";

export default async function AgentPage({
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
    <main className="relative h-screen overflow-hidden bg-background text-foreground">
      <AuthStatusModal status={status} />
      <AgentClient
        email={session.user.email}
        name={session.user.name}
      />
    </main>
  );
}
