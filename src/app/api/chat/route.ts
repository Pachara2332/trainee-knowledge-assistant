import { auth } from "../../../lib/auth";
import { fallbackAiUsage, streamAiAnswer } from "../../../lib/chat/ai";
import type { ChatAttachment } from "../../../lib/chat/types";
import {
  ChatValidationError,
  normalizeAttachment,
  normalizeMessages,
  type ChatMessage,
  type TokenUsage,
} from "../../../lib/gemini";
import { buildTxtRagContext } from "../../../lib/rag/txt-rag";
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

  let attachmentForModel = attachment;
  const chromaUrl = process.env.CHROMA_URL?.trim();

  if (
    chromaUrl &&
    attachment?.mimeType === "text/plain" &&
    attachment.text &&
    attachment.text.length > 0
  ) {
    try {
      const ragText = await buildTxtRagContext({
        userKey: session.user.email ?? session.user.id ?? "anonymous",
        fileName: attachment.name,
        fullText: attachment.text,
        userQuestion: messages[messages.length - 1].content,
        signal: request.signal,
      });
      const ragAttachment: ChatAttachment = {
        ...attachment,
        text: ragText,
      };
      attachmentForModel = ragAttachment;
    } catch (error) {
      console.error("Chroma RAG skipped:", error);
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let answer = "";
      let usage: TokenUsage | null = null;

      try {
        await streamAiAnswer({
          messages,
          attachment: attachmentForModel,
          signal: request.signal,
          onText(text) {
            answer += text;
            sendEvent(controller, "token", { text });
          },
          onUsage(nextUsage) {
            usage = nextUsage;
          },
          onProvider(provider) {
            sendEvent(controller, "provider", { provider });
          },
        });

        sendEvent(controller, "usage", usage ?? fallbackAiUsage(messages, answer));
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
