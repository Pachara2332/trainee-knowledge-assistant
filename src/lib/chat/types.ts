export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type ChatAttachment = {
  name: string;
  mimeType: "application/pdf" | "text/plain";
  text?: string;
  data?: string;
};

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };
