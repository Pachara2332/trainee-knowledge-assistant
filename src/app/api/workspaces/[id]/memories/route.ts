import { getMemories } from "../../../../../lib/agent/memory";
import { auth } from "../../../../../lib/auth";
import {
  WorkspacePermissionError,
  assertMember,
} from "../../../../../lib/workspace/workspace";

export const runtime = "nodejs";

function getUserId(session: { user?: { id?: unknown } } | null) {
  return session?.user && "id" in session.user && typeof session.user.id === "string"
    ? session.user.id
    : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = getUserId(session);

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await assertMember(id, userId);
    return Response.json({ memories: await getMemories(id) });
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error("[workspace-memories] list failed", error);
    return Response.json(
      { error: "Unable to load workspace memories." },
      { status: 500 },
    );
  }
}
