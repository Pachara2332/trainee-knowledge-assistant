import { auth } from "../../../lib/auth";
import {
  createWorkspace,
  getUserWorkspaces,
} from "../../../lib/workspace/workspace";

export const runtime = "nodejs";

function getUserId(session: { user?: { id?: unknown } } | null) {
  return session?.user && "id" in session.user && typeof session.user.id === "string"
    ? session.user.id
    : null;
}

export async function GET() {
  const session = await auth();
  const userId = getUserId(session);

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return Response.json({ workspaces: await getUserWorkspaces(userId) });
  } catch (error) {
    console.error("[workspaces] list failed", error);
    return Response.json(
      { error: "Unable to load workspaces." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = getUserId(session);

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return Response.json(
        { error: "Workspace name is required." },
        { status: 400 },
      );
    }

    return Response.json(
      { workspace: await createWorkspace(userId, name) },
      { status: 201 },
    );
  } catch (error) {
    console.error("[workspaces] create failed", error);
    return Response.json(
      { error: "Unable to create workspace." },
      { status: 500 },
    );
  }
}
