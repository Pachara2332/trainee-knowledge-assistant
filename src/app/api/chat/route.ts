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
import { extractPdfTextFromBase64 } from "../../../lib/rag/pdf-text";
import { buildDocumentRagContext } from "../../../lib/rag/txt-rag";
import { checkRateLimit } from "../../../lib/security/rate-limit";
import {
  WorkspacePermissionError,
  assertMember,
  getUserWorkspaces,
} from "../../../lib/workspace/workspace";
import { appendChatExchange } from "../../../repositories/chat-history";

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

function getUserId(session: { user?: { id?: unknown } } | null) {
  return session?.user && "id" in session.user && typeof session.user.id === "string"
    ? session.user.id
    : null;
}

function buildExtractedDocumentContext({
  fileName,
  text,
  truncated,
}: {
  fileName: string;
  text: string;
  truncated: boolean;
}) {
  return [
    `The following text was extracted from [${fileName}].`,
    `Treat it as primary document evidence; cite as [${fileName}] when you rely on it.`,
    truncated
      ? "Only the first extractable portion is included because the PDF text is long."
      : "",
    "",
    text.slice(0, 40_000),
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = getUserId(session);

  if (!session?.user || !userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit({
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
  let conversationId: string | null = null;
  let workspaceId = "";

  try {
    const body = await request.json();
    messages = normalizeMessages(body.messages);
    attachment = normalizeAttachment(body.attachment);
    conversationId =
      typeof body.conversationId === "string" && body.conversationId.trim()
        ? body.conversationId.trim()
        : null;
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

    const message =
      error instanceof ChatValidationError ? error.message : "Invalid JSON payload.";
    return Response.json({ error: message }, { status: 400 });
  }

  let attachmentForModel = attachment;
  const chromaUrl = process.env.CHROMA_URL?.trim();

  if (attachment?.mimeType === "text/plain" && attachment.text) {
    try {
      const ragText = chromaUrl
        ? await buildDocumentRagContext({
            workspaceId,
            fileName: attachment.name,
            fullText: attachment.text,
            userQuestion: messages[messages.length - 1].content,
            signal: request.signal,
          })
        : buildExtractedDocumentContext({
            fileName: attachment.name,
            text: attachment.text,
            truncated: attachment.text.length >= 40_000,
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

  if (attachment?.mimeType === "application/pdf" && attachment.data) {
    try {
      const extracted = await extractPdfTextFromBase64(attachment.data);
      const documentContext = chromaUrl
        ? await buildDocumentRagContext({
            workspaceId,
            fileName: attachment.name,
            fullText: extracted.text,
            userQuestion: messages[messages.length - 1].content,
            signal: request.signal,
          })
        : buildExtractedDocumentContext({
            fileName: attachment.name,
            text: extracted.text,
            truncated: extracted.truncated,
          });

      attachmentForModel = {
        name: attachment.name,
        mimeType: "text/plain",
        text: documentContext,
      };
    } catch (error) {
      console.error("PDF text extraction skipped:", error);
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let answer = "";
      let usage: TokenUsage | null = null;
      let provider: string | null = null;

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
          onProvider(nextProvider) {
            provider = nextProvider;
            sendEvent(controller, "provider", { provider: nextProvider });
          },
        });

        if (conversationId) {
          await appendChatExchange({
            userId,
            conversationId,
            workspaceId,
            userContent: messages[messages.length - 1].content,
            userAttachment: attachment
              ? {
                  name: attachment.name,
                  mimeType: attachment.mimeType,
                }
              : null,
            assistantContent: answer,
            provider,
            tokenUsage: usage ?? fallbackAiUsage(messages, answer),
          });
        }

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
