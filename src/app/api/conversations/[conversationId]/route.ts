import { auth } from "../../../../lib/auth";
import {
  WorkspacePermissionError,
  assertMember,
  getUserWorkspaces,
} from "../../../../lib/workspace/workspace";
import { deleteConversationForUser } from "../../../../repositories/chat-history";

export const runtime = "nodejs";

function getUserId(session: { user?: { id?: unknown } } | null) {
  return session?.user && "id" in session.user && typeof session.user.id === "string"
    ? session.user.id
    : null;
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await auth();
  const userId = getUserId(session);

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { conversationId } = await params;
    const url = new URL(request.url);
    let workspaceId =
      url.searchParams.get("workspaceId")?.trim() ||
      url.searchParams.get("ws")?.trim() ||
      "";

    if (!workspaceId) {
      const workspaces = await getUserWorkspaces(userId);
      workspaceId = workspaces[0]?.id ?? "";
    }

    if (!workspaceId) {
      return Response.json({ error: "Workspace is required." }, { status: 400 });
    }

    await assertMember(workspaceId, userId);
    await deleteConversationForUser({ userId, conversationId, workspaceId });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error("[conversations] delete failed", error);
    return Response.json(
      { error: "Unable to delete conversation." },
      { status: 500 },
    );
  }
}
