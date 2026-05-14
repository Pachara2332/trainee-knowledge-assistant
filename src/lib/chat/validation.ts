import type { ChatAttachment, ChatMessage } from "./types";

export class ChatValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatValidationError";
  }
}

const MAX_MESSAGE_CHARS = 8_000;
const MAX_CONTEXT_CHARS = 40_000;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const SAFE_FILE_NAME = /[^a-zA-Z0-9._ -]/g;

export function sanitizeFileName(fileName: string) {
  const cleanName = fileName.replace(SAFE_FILE_NAME, "").trim();
  return cleanName.slice(0, 120) || "attachment";
}

export function normalizeMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) {
    throw new ChatValidationError("Messages must be an array.");
  }

  return messages
    .slice(-20)
    .map((message) => {
      if (!message || typeof message !== "object") {
        throw new ChatValidationError("Each message must be an object.");
      }

      const role = "role" in message ? message.role : undefined;
      const content = "content" in message ? message.content : undefined;

      if (role !== "user" && role !== "assistant") {
        throw new ChatValidationError("Message role must be user or assistant.");
      }

      if (typeof content !== "string" || !content.trim()) {
        throw new ChatValidationError("Message content is required.");
      }

      return {
        role,
        content: content.trim().slice(0, MAX_MESSAGE_CHARS),
      };
    })
    .filter((message) => message.content.length > 0);
}

export function normalizeAttachment(input: unknown): ChatAttachment | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const name = "name" in input && typeof input.name === "string" ? input.name : "";
  const mimeType =
    "mimeType" in input && typeof input.mimeType === "string" ? input.mimeType : "";
  const text = "text" in input && typeof input.text === "string" ? input.text : "";
  const data = "data" in input && typeof input.data === "string" ? input.data : "";

  if (mimeType !== "application/pdf" && mimeType !== "text/plain") {
    throw new ChatValidationError("Only PDF or TXT files are supported.");
  }

  if (!text && !data) {
    throw new ChatValidationError("Attachment content is empty.");
  }

  const approxBytes = Math.ceil(((data || text).length * 3) / 4);

  if (approxBytes > MAX_ATTACHMENT_BYTES) {
    throw new ChatValidationError("File must be 10MB or smaller.");
  }

  return {
    name: sanitizeFileName(name),
    mimeType,
    text: text.slice(0, MAX_CONTEXT_CHARS),
    data,
  };
}
