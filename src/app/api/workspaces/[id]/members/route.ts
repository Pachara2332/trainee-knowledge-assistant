import { auth } from "../../../../../lib/auth";
import {
  WorkspacePermissionError,
  addMember,
  assertMember,
  getWorkspaceMembers,
  removeMember,
  type WorkspaceRole,
} from "../../../../../lib/workspace/workspace";

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

function parseRole(value: unknown): WorkspaceRole {
  return value === "owner" || value === "admin" || value === "member"
    ? value
    : "member";
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
    return Response.json({ members: await getWorkspaceMembers(id) });
  } catch (error) {
    const response = forbidden(error);
    if (response) {
      return response;
    }
    console.error("[workspace-members] list failed", error);
    return Response.json(
      { error: "Unable to load workspace members." },
      { status: 500 },
    );
  }
}

export async function POST(
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
    const email = typeof body.email === "string" ? body.email.trim() : "";

    if (!email) {
      return Response.json({ error: "Email is required." }, { status: 400 });
    }

    return Response.json(
      { member: await addMember(id, email, parseRole(body.role)) },
      { status: 201 },
    );
  } catch (error) {
    const response = forbidden(error);
    if (response) {
      return response;
    }
    const status = error instanceof Error && error.message === "User not found." ? 404 : 500;
    console.error("[workspace-members] add failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to add member." },
      { status },
    );
  }
}

export async function DELETE(
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

    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const memberUserId =
      typeof body.userId === "string"
        ? body.userId
        : url.searchParams.get("userId") ?? "";

    if (!memberUserId) {
      return Response.json({ error: "userId is required." }, { status: 400 });
    }

    await removeMember(id, memberUserId);
    return Response.json({ ok: true });
  } catch (error) {
    const response = forbidden(error);
    if (response) {
      return response;
    }
    console.error("[workspace-members] remove failed", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to remove member.",
      },
      { status: 500 },
    );
  }
}
