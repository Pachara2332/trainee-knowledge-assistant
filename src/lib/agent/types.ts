export type AgentToolName =
  | "search_documents"
  | "read_document"
  | "summarize_document"
  | "web_search"
  | "create_report"
  | "send_email"
  | "execute_code"
  | "list_conversations"
  | "create_task"
  | "remember"
  | "recall";

export type AgentStepStatus = "started" | "completed" | "failed";

export type AgentTraceStep = {
  id: string;
  tool: AgentToolName | "agent";
  title: string;
  status: AgentStepStatus;
  input?: unknown;
  output?: unknown;
  error?: string;
  createdAt: string;
};

export type AgentMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentContext = {
  userId: string;
  workspaceId: string;
  workspaceRoot: string;
  signal?: AbortSignal;
};

export type AgentRunResult = {
  answer: string;
  trace: AgentTraceStep[];
};

export type AgentToolResult = {
  ok: boolean;
  content: unknown;
};

export type AgentToolExecutor = (
  args: Record<string, unknown>,
  context: AgentContext,
) => Promise<AgentToolResult>;
