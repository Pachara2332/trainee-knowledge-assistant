export type Role = "user" | "assistant";

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type Message = {
  id: string;
  role: Role;
  content: string;
  usage?: TokenUsage;
  attachmentName?: string;
};

export type ClientAttachment = {
  name: string;
  mimeType: "application/pdf" | "text/plain";
  text?: string;
  data?: string;
};
