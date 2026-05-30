import { auth } from "../../../lib/auth";
import {
  createConversationForUser,
  listConversationsForUser,
} from "../../../repositories/chat-history";
import {
  WorkspacePermissionError,
  assertMember,
  getUserWorkspaces,
} from "../../../lib/workspace/workspace";

export const runtime = "nodejs";

function getUserId(session: { user?: { id?: unknown } } | null) {
  return session?.user && "id" in session.user && typeof session.user.id === "string"
    ? session.user.id
    : null;
}

async function resolveWorkspaceId(userId: string, request: Request, body?: unknown) {
  const url = new URL(request.url);
  const bodyWorkspaceId =
    body && typeof body === "object" && "workspaceId" in body
      ? (body as { workspaceId?: unknown }).workspaceId
      : undefined;
  const requested =
    typeof bodyWorkspaceId === "string" && bodyWorkspaceId.trim()
      ? bodyWorkspaceId.trim()
      : url.searchParams.get("workspaceId")?.trim() || url.searchParams.get("ws")?.trim() || "";

  if (requested) {
    await assertMember(requested, userId);
    return requested;
  }

  const workspaces = await getUserWorkspaces(userId);
  const fallback = workspaces[0]?.id;

  if (!fallback) {
    throw new Error("Workspace is required.");
  }

  await assertMember(fallback, userId);
  return fallback;
}

export async function GET(request: Request) {
  const session = await auth();
  const userId = getUserId(session);

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const workspaceId = await resolveWorkspaceId(userId, request);
    return Response.json({
      conversations: await listConversationsForUser({ userId, workspaceId }),
    });
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error("[conversations] list failed", error);
    return Response.json(
      { error: "Unable to load conversations." },
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
    const title = typeof body.title === "string" ? body.title : "New Chat";
    const workspaceId = await resolveWorkspaceId(userId, request, body);

    return Response.json(
      {
        conversation: await createConversationForUser({
          userId,
          title,
          workspaceId,
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error("[conversations] create failed", error);
    return Response.json(
      { error: "Unable to create conversation." },
      { status: 500 },
    );
  }
}
