import { deleteMemory } from "../../../../../../lib/agent/memory";
import { auth } from "../../../../../../lib/auth";
import {
  WorkspacePermissionError,
  assertMember,
} from "../../../../../../lib/workspace/workspace";

export const runtime = "nodejs";

function getUserId(session: { user?: { id?: unknown } } | null) {
  return session?.user && "id" in session.user && typeof session.user.id === "string"
    ? session.user.id
    : null;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; key: string }> },
) {
  const session = await auth();
  const userId = getUserId(session);

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, key } = await params;
    await assertMember(id, userId);
    await deleteMemory(id, decodeURIComponent(key));
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error("[workspace-memories] delete failed", error);
    return Response.json(
      { error: "Unable to delete workspace memory." },
      { status: 500 },
    );
  }
}
