import { auth } from "../../../lib/auth";
import {
  createConversationForUser,
  listConversationsForUser,
} from "../../../repositories/chat-history";

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
    return Response.json({
      conversations: await listConversationsForUser(userId),
    });
  } catch (error) {
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
    const workspaceId =
      typeof body.workspaceId === "string" && body.workspaceId.trim()
        ? body.workspaceId.trim()
        : "default";

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
    console.error("[conversations] create failed", error);
    return Response.json(
      { error: "Unable to create conversation." },
      { status: 500 },
    );
  }
}
