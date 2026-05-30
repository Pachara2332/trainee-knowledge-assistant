import type { AgentToolName } from "./types";

export type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
};

export type AgentToolDefinition = {
  name: AgentToolName;
  description: string;
  parameters: JsonSchema;
};

export const agentToolDefinitions: AgentToolDefinition[] = [
  {
    name: "search_documents",
    description:
      "Search indexed workspace documents in ChromaDB for relevant excerpts.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query." },
        limit: {
          type: "number",
          description: "Maximum excerpts to return. Defaults to 5.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "read_document",
    description:
      "Read a text or markdown file from the local workspace by relative path.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Workspace-relative file path." },
      },
      required: ["path"],
    },
  },
  {
    name: "summarize_document",
    description:
      "Read a workspace document and return a compact extractive summary.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Workspace-relative file path." },
        focus: { type: "string", description: "Optional summary focus." },
      },
      required: ["path"],
    },
  },
  {
    name: "web_search",
    description:
      "Search the public internet through Tavily for current information.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Internet search query." },
        maxResults: {
          type: "number",
          description: "Maximum search results. Defaults to 5.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "create_report",
    description:
      "Create a markdown report and persist it to the application database.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Report title." },
        markdown: { type: "string", description: "Report body in markdown." },
      },
      required: ["title", "markdown"],
    },
  },
  {
    name: "send_email",
    description:
      "Send an email summary through Resend. Requires RESEND_API_KEY and RESEND_FROM_EMAIL.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address." },
        subject: { type: "string", description: "Email subject." },
        markdown: { type: "string", description: "Markdown email content." },
      },
      required: ["to", "subject", "markdown"],
    },
  },
  {
    name: "execute_code",
    description:
      "Run a short Python snippet for data analysis. Disabled unless AGENT_ENABLE_CODE_EXECUTION=true.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "Python code snippet." },
      },
      required: ["code"],
    },
  },
  {
    name: "list_conversations",
    description: "List recent conversations in the current workspace.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum conversations to return. Defaults to 10.",
        },
      },
    },
  },
  {
    name: "create_task",
    description:
      "Create a follow-up task that the agent decided should be tracked.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title." },
        detail: { type: "string", description: "Task details." },
      },
      required: ["title"],
    },
  },
  {
    name: "remember",
    description:
      "บันทึกข้อมูลสำคัญไว้ใช้ในอนาคต เช่น preference, context, หรือผลสรุปงาน",
    parameters: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "ชื่อ memory เช่น 'project_goal'",
        },
        value: {
          type: "string",
          description: "เนื้อหาที่ต้องการจำ",
        },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "recall",
    description: "ดึง memory ที่บันทึกไว้ก่อนหน้า",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "คำค้นหา memory ที่ต้องการ",
        },
      },
      required: ["query"],
    },
  },
];
