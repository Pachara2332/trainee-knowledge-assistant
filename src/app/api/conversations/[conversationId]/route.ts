import { auth } from "../../../../lib/auth";
import { deleteConversationForUser } from "../../../../repositories/chat-history";

export const runtime = "nodejs";

function getUserId(session: { user?: { id?: unknown } } | null) {
  return session?.user && "id" in session.user && typeof session.user.id === "string"
    ? session.user.id
    : null;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await auth();
  const userId = getUserId(session);

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { conversationId } = await params;
    await deleteConversationForUser({ userId, conversationId });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[conversations] delete failed", error);
    return Response.json(
      { error: "Unable to delete conversation." },
      { status: 500 },
    );
  }
}
