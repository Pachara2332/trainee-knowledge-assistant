import { auth } from "../../../lib/auth";
import {
  ChatValidationError,
  fallbackUsage,
  normalizeAttachment,
  normalizeMessages,
  streamGeminiAnswer,
  type ChatMessage,
  type TokenUsage,
} from "../../../lib/gemini";
import { checkRateLimit } from "../../../lib/security/rate-limit";

export const runtime = "nodejs";

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

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit({
    key: session.user.email ?? "anonymous",
    limit: 20,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Too many requests. Please slow down for a moment." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfter),
        },
      },
    );
  }

  let messages: ChatMessage[];
  let attachment = null;

  try {
    const body = await request.json();
    messages = normalizeMessages(body.messages);
    attachment = normalizeAttachment(body.attachment);

    if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
      return Response.json(
        { error: "The latest message must be from the user." },
        { status: 400 },
      );
    }
  } catch (error) {
    const message =
      error instanceof ChatValidationError ? error.message : "Invalid JSON payload.";
    return Response.json({ error: message }, { status: 400 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let answer = "";
      let usage: TokenUsage | null = null;

      try {
        await streamGeminiAnswer({
          messages,
          attachment,
          signal: request.signal,
          onText(text) {
            answer += text;
            sendEvent(controller, "token", { text });
          },
          onUsage(nextUsage) {
            usage = nextUsage;
          },
        });

        sendEvent(controller, "usage", usage ?? fallbackUsage(messages, answer));
        sendEvent(controller, "done", {});
      } catch (error) {
        const message =
          error instanceof Error && error.name === "TimeoutError"
            ? "Gemini request timed out. Please try again."
            : error instanceof Error
              ? error.message
              : "Unable to generate a response.";

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
