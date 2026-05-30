import type { ChatAttachment } from "../lib/chat/types";
import { getPool, type PoolLike } from "../db/pool";
import {
  ensureDefaultWorkspaceForUser,
  ensureConversationWorkspaceSchema,
  ensureWorkspaceTables,
} from "../lib/db/schema";

export type PersistedTokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type PersistedMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  provider: string | null;
  tokenUsage: PersistedTokenUsage | null;
  attachments: ChatAttachment[] | null;
  createdAt: string;
};

export type PersistedConversation = {
  id: string;
  userId: string;
  workspaceId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: PersistedMessage[];
};

type ConversationRow = {
  id: string;
  user_id: string;
  workspace_id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  provider: string | null;
  token_usage: PersistedTokenUsage | null;
  attachments: ChatAttachment[] | null;
  created_at: Date;
};

const MAX_CONVERSATIONS = 20;
const MAX_MESSAGES_PER_CONVERSATION = 40;

const globalForChatHistory = globalThis as typeof globalThis & {
  chatHistoryTablesReady?: boolean;
};

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function toTitle(content: string) {
  const title = content.trim() || "New Chat";
  return title.length > 36 ? `${title.slice(0, 33)}...` : title;
}

function mapMessage(row: MessageRow): PersistedMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    provider: row.provider,
    tokenUsage: row.token_usage,
    attachments: row.attachments,
    createdAt: toIso(row.created_at),
  };
}

function mapConversation(
  row: ConversationRow,
  messages: PersistedMessage[],
): PersistedConversation {
  return {
    id: row.id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    title: row.title,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    messages,
  };
}

async function ensureChatHistoryTables(pool: PoolLike) {
  if (globalForChatHistory.chatHistoryTablesReady) {
    return;
  }

  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  await ensureWorkspaceTables(pool);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'New Chat',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      provider TEXT,
      token_usage JSONB,
      attachments JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC)",
  );
  await ensureConversationWorkspaceSchema(pool);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at ASC)",
  );

  globalForChatHistory.chatHistoryTablesReady = true;
}

async function requirePool() {
  const pool = await getPool();

  if (!pool) {
    throw new Error("Database is not configured.");
  }

  await ensureChatHistoryTables(pool);
  return pool;
}

async function getConversationRows(pool: PoolLike, workspaceId: string) {
  const result = await pool.query<ConversationRow>(
    `
      SELECT id, user_id, workspace_id, title, created_at, updated_at
      FROM conversations
      WHERE workspace_id = $1
      ORDER BY updated_at DESC
      LIMIT $2
    `,
    [workspaceId, MAX_CONVERSATIONS],
  );

  return result.rows;
}

async function getMessagesForConversationIds(pool: PoolLike, conversationIds: string[]) {
  if (conversationIds.length === 0) {
    return [];
  }

  const result = await pool.query<MessageRow>(
    `
      SELECT id, conversation_id, role, content, provider, token_usage, attachments, created_at
      FROM (
        SELECT
          messages.*,
          ROW_NUMBER() OVER (
            PARTITION BY conversation_id
            ORDER BY created_at DESC
          ) AS row_number
        FROM messages
        WHERE conversation_id = ANY($1::uuid[])
      ) ranked_messages
      WHERE row_number <= $2
      ORDER BY conversation_id, created_at ASC
    `,
    [conversationIds, MAX_MESSAGES_PER_CONVERSATION],
  );

  return result.rows.map(mapMessage);
}

export async function listConversationsForUser({
  userId,
  workspaceId,
}: {
  userId: string;
  workspaceId?: string;
}) {
  const pool = await requirePool();
  const resolvedWorkspaceId =
    workspaceId ?? (await ensureDefaultWorkspaceForUser(pool, userId));
  const conversations = await getConversationRows(pool, resolvedWorkspaceId);
  const messages = await getMessagesForConversationIds(
    pool,
    conversations.map((conversation) => conversation.id),
  );

  return conversations.map((conversation) =>
    mapConversation(
      conversation,
      messages.filter((message) => message.conversationId === conversation.id),
    ),
  );
}

export async function createConversationForUser({
  userId,
  title = "New Chat",
  workspaceId,
}: {
  userId: string;
  title?: string;
  workspaceId?: string;
}) {
  const pool = await requirePool();
  const resolvedWorkspaceId =
    workspaceId && workspaceId !== "default"
      ? workspaceId
      : await ensureDefaultWorkspaceForUser(pool, userId);
  const result = await pool.query<ConversationRow>(
    `
      INSERT INTO conversations (user_id, workspace_id, title)
      VALUES ($1, $2, $3)
      RETURNING id, user_id, workspace_id, title, created_at, updated_at
    `,
    [userId, resolvedWorkspaceId, toTitle(title)],
  );

  return mapConversation(result.rows[0], []);
}

export async function deleteConversationForUser({
  userId,
  conversationId,
  workspaceId,
}: {
  userId: string;
  conversationId: string;
  workspaceId?: string;
}) {
  const pool = await requirePool();
  const resolvedWorkspaceId =
    workspaceId ?? (await ensureDefaultWorkspaceForUser(pool, userId));
  await pool.query(
    "DELETE FROM conversations WHERE id = $1 AND workspace_id = $2",
    [conversationId, resolvedWorkspaceId],
  );
}

export async function appendChatExchange({
  userId,
  conversationId,
  workspaceId,
  userContent,
  userAttachment,
  assistantContent,
  provider,
  tokenUsage,
}: {
  userId: string;
  conversationId: string;
  workspaceId?: string;
  userContent: string;
  userAttachment: ChatAttachment | null;
  assistantContent: string;
  provider: string | null;
  tokenUsage: PersistedTokenUsage | null;
}) {
  const pool = await requirePool();
  const resolvedWorkspaceId =
    workspaceId ?? (await ensureDefaultWorkspaceForUser(pool, userId));
  const conversation = await pool.query<ConversationRow>(
    `
      SELECT id, user_id, workspace_id, title, created_at, updated_at
      FROM conversations
      WHERE id = $1 AND workspace_id = $2
      LIMIT 1
    `,
    [conversationId, resolvedWorkspaceId],
  );

  if (conversation.rows.length === 0) {
    throw new Error("Conversation not found.");
  }

  const messageCount = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM messages WHERE conversation_id = $1",
    [conversationId],
  );
  const shouldUpdateTitle =
    Number(messageCount.rows[0]?.count ?? "0") === 0 ||
    conversation.rows[0].title === "New Chat";

  await pool.query(
    `
      INSERT INTO messages (conversation_id, role, content, attachments)
      VALUES ($1, 'user', $2, $3::jsonb)
    `,
    [
      conversationId,
      userContent,
      userAttachment ? JSON.stringify([userAttachment]) : null,
    ],
  );
  await pool.query(
    `
      INSERT INTO messages (conversation_id, role, content, provider, token_usage)
      VALUES ($1, 'assistant', $2, $3, $4::jsonb)
    `,
    [
      conversationId,
      assistantContent,
      provider,
      tokenUsage ? JSON.stringify(tokenUsage) : null,
    ],
  );
  await pool.query(
    `
      UPDATE conversations
      SET title = CASE WHEN $3 THEN $4 ELSE title END,
          updated_at = NOW()
      WHERE id = $1 AND user_id = $2
    `,
    [conversationId, userId, shouldUpdateTitle, toTitle(userContent)],
  );
}
