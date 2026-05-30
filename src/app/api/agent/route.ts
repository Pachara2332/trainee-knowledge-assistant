import { auth } from "../../../lib/auth";
import { runAgent } from "../../../lib/agent/engine";
import type { AgentMessage } from "../../../lib/agent/types";
import { checkRateLimit } from "../../../lib/security/rate-limit";
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

function normalizeMessages(value: unknown): AgentMessage[] {
  if (!Array.isArray(value)) {
    throw new Error("messages must be an array.");
  }

  return value.map((message) => {
    if (!message || typeof message !== "object") {
      throw new Error("Each message must be an object.");
    }

    const row = message as Record<string, unknown>;

    if (row.role !== "user" && row.role !== "assistant") {
      throw new Error("Message role must be user or assistant.");
    }

    if (typeof row.content !== "string" || !row.content.trim()) {
      throw new Error("Message content is required.");
    }

    return {
      role: row.role,
      content: row.content.trim(),
    };
  });
}

function sendEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  event: string,
  data: unknown,
) {
  const encoder = new TextEncoder();
  controller.enqueue(
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
  );
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = getUserId(session);

  if (!session?.user || !userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user;

  const rateLimit = await checkRateLimit({
    key: `agent:${user.email ?? userId}`,
    limit: 12,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Too many agent requests. Please slow down for a moment." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfter),
        },
      },
    );
  }

  let messages: AgentMessage[];
  let workspaceId: string;

  try {
    const body = await request.json();
    messages = normalizeMessages(body.messages);
    workspaceId =
      typeof body.workspaceId === "string" && body.workspaceId.trim()
        ? body.workspaceId.trim()
        : "";

    if (!workspaceId) {
      const workspaces = await getUserWorkspaces(userId);
      workspaceId = workspaces[0]?.id ?? "";
    }

    if (!workspaceId) {
      return Response.json({ error: "Workspace is required." }, { status: 400 });
    }

    await assertMember(workspaceId, userId);

    if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
      return Response.json(
        { error: "The latest message must be from the user." },
        { status: 400 },
      );
    }
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        sendEvent(controller, "status", { label: "Thinking" });
        await runAgent({
          messages,
          context: {
            userId,
            workspaceId,
            workspaceRoot: process.cwd(),
            signal: request.signal,
          },
          onStep(step) {
            sendEvent(controller, "step", step);
          },
          onFinal(answer) {
            sendEvent(controller, "final", { answer });
          },
        });
        sendEvent(controller, "done", {});
      } catch (error) {
        const message =
          error instanceof Error && error.name === "TimeoutError"
            ? "Agent request timed out. Please try again."
            : error instanceof Error
              ? error.message
              : "Unable to run agent.";

        sendEvent(controller, "error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
