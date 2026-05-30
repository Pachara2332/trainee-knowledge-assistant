import { auth } from "../../../../lib/auth";
import {
  WorkspacePermissionError,
  assertMember,
  deleteWorkspace,
  getWorkspaceById,
  renameWorkspace,
} from "../../../../lib/workspace/workspace";

export const runtime = "nodejs";

function getUserId(session: { user?: { id?: unknown } } | null) {
  return session?.user && "id" in session.user && typeof session.user.id === "string"
    ? session.user.id
    : null;
}

function forbidden(error: unknown) {
  return error instanceof WorkspacePermissionError
    ? Response.json({ error: "Forbidden" }, { status: 403 })
    : null;
}

function requireAdmin(role: string) {
  if (role !== "owner" && role !== "admin") {
    throw new WorkspacePermissionError();
  }
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
    return Response.json({ workspace: await getWorkspaceById(id, userId) });
  } catch (error) {
    const response = forbidden(error);
    if (response) {
      return response;
    }
    console.error("[workspace] get failed", error);
    return Response.json(
      { error: "Unable to load workspace." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = getUserId(session);

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const workspace = await assertMember(id, userId);
    requireAdmin(workspace.role);

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return Response.json(
        { error: "Workspace name is required." },
        { status: 400 },
      );
    }

    return Response.json({ workspace: await renameWorkspace(id, name) });
  } catch (error) {
    const response = forbidden(error);
    if (response) {
      return response;
    }
    console.error("[workspace] rename failed", error);
    return Response.json(
      { error: "Unable to rename workspace." },
      { status: 500 },
    );
  }
}

export async function DELETE(
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
    const workspace = await assertMember(id, userId);

    if (workspace.role !== "owner") {
      throw new WorkspacePermissionError();
    }

    await deleteWorkspace(id);
    return Response.json({ ok: true });
  } catch (error) {
    const response = forbidden(error);
    if (response) {
      return response;
    }
    console.error("[workspace] delete failed", error);
    return Response.json(
      { error: "Unable to delete workspace." },
      { status: 500 },
    );
  }
}
