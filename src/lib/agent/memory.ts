import { getPool } from "../../db/pool";
import { ensureAgentMemorySchema } from "../db/schema";

export type AgentMemorySource = "agent" | "user" | "system";

export type AgentMemory = {
  id: string;
  workspaceId: string;
  userId: string;
  key: string;
  value: string;
  source: AgentMemorySource;
  createdAt: string;
  updatedAt: string;
};

type AgentMemoryRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  key: string;
  value: string;
  source: AgentMemorySource;
  created_at: Date;
  updated_at: Date;
};

function toIso(value: Date) {
  return value.toISOString();
}

function mapMemory(row: AgentMemoryRow): AgentMemory {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    key: row.key,
    value: row.value,
    source: row.source,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function normalizeKey(key: string) {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

async function requireMemoryPool() {
  const pool = await getPool();

  if (!pool) {
    throw new Error("Database is not configured.");
  }

  await ensureAgentMemorySchema(pool);
  return pool;
}

export async function setMemory(
  workspaceId: string,
  userId: string,
  key: string,
  value: string,
  source: AgentMemorySource,
) {
  const pool = await requireMemoryPool();
  const normalizedKey = normalizeKey(key);
  const trimmedValue = value.trim();

  if (!normalizedKey) {
    throw new Error("Memory key is required.");
  }

  if (!trimmedValue) {
    throw new Error("Memory value is required.");
  }

  const result = await pool.query<AgentMemoryRow>(
    `
      INSERT INTO agent_memories (workspace_id, user_id, key, value, source)
      VALUES ($1::uuid, $2::uuid, $3, $4, $5)
      ON CONFLICT (workspace_id, key) DO UPDATE
      SET value = EXCLUDED.value,
          source = EXCLUDED.source,
          user_id = EXCLUDED.user_id,
          updated_at = NOW()
      RETURNING id, workspace_id, user_id, key, value, source, created_at, updated_at
    `,
    [workspaceId, userId, normalizedKey, trimmedValue, source],
  );

  return mapMemory(result.rows[0]);
}

export async function getMemories(workspaceId: string): Promise<AgentMemory[]> {
  const pool = await requireMemoryPool();
  const result = await pool.query<AgentMemoryRow>(
    `
      SELECT id, workspace_id, user_id, key, value, source, created_at, updated_at
      FROM agent_memories
      WHERE workspace_id = $1::uuid
      ORDER BY updated_at DESC
    `,
    [workspaceId],
  );

  return result.rows.map(mapMemory);
}

export async function searchMemories(workspaceId: string, query: string) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return getMemories(workspaceId);
  }

  const pool = await requireMemoryPool();
  const terms = trimmedQuery
    .toLowerCase()
    .split(/[^a-z0-9._:-]+/)
    .filter(Boolean)
    .slice(0, 8);

  if (terms.length === 0) {
    return getMemories(workspaceId);
  }

  const result = await pool.query<AgentMemoryRow>(
    `
      SELECT id, workspace_id, user_id, key, value, source, created_at, updated_at
      FROM agent_memories
      WHERE workspace_id = $1::uuid
        AND (
          key ILIKE ANY($2::text[])
          OR value ILIKE ANY($2::text[])
        )
      ORDER BY updated_at DESC
      LIMIT 12
    `,
    [workspaceId, terms.map((term) => `%${term}%`)],
  );

  return result.rows.map(mapMemory);
}

export async function deleteMemory(workspaceId: string, key: string) {
  const pool = await requireMemoryPool();
  await pool.query(
    `
      DELETE FROM agent_memories
      WHERE workspace_id = $1::uuid
        AND key = $2
    `,
    [workspaceId, normalizeKey(key)],
  );
}

export function formatMemoriesAsContext(memories: AgentMemory[]) {
  if (memories.length === 0) {
    return "No persistent memories are stored for this workspace yet.";
  }

  return memories
    .map((memory) => {
      const updated = memory.updatedAt.slice(0, 10);
      return `- ${memory.key} (${memory.source}, updated ${updated}): ${memory.value}`;
    })
    .join("\n");
}
