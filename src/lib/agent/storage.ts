import { getPool, type PoolLike } from "../../db/pool";
import {
  ensureAgentMemorySchema,
  ensureDefaultWorkspaceForUser,
  ensureWorkspaceColumn,
  ensureWorkspaceTables,
} from "../db/schema";
import { setMemory } from "./memory";

type ReportRow = {
  id: string;
  workspace_id: string;
  title: string;
  markdown: string;
  created_at: Date;
};

type TaskRow = {
  id: string;
  workspace_id: string;
  title: string;
  detail: string | null;
  created_at: Date;
};

const globalForAgentStorage = globalThis as typeof globalThis & {
  agentTablesReady?: boolean;
};

async function ensureAgentTables(pool: PoolLike) {
  if (globalForAgentStorage.agentTablesReady) {
    return;
  }

  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  await ensureWorkspaceTables(pool);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      markdown TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      detail TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await ensureAgentMemorySchema(pool);
  await ensureWorkspaceColumn({
    pool,
    tableName: "agent_reports",
    constraintName: "agent_reports_workspace_id_fkey",
  });
  await ensureWorkspaceColumn({
    pool,
    tableName: "agent_tasks",
    constraintName: "agent_tasks_workspace_id_fkey",
  });
  await ensureWorkspaceColumn({
    pool,
    tableName: "agent_runs",
    constraintName: "agent_runs_workspace_id_fkey",
  });

  globalForAgentStorage.agentTablesReady = true;
}

async function requireAgentPool() {
  const pool = await getPool();

  if (!pool) {
    throw new Error("Database is not configured.");
  }

  await ensureAgentTables(pool);
  return pool;
}

function toIso(value: Date) {
  return value.toISOString();
}

export async function createAgentReport({
  userId,
  workspaceId,
  title,
  markdown,
}: {
  userId: string;
  workspaceId?: string;
  title: string;
  markdown: string;
}) {
  const pool = await requireAgentPool();
  const resolvedWorkspaceId =
    workspaceId ?? (await ensureDefaultWorkspaceForUser(pool, userId));
  const result = await pool.query<ReportRow>(
    `
      INSERT INTO agent_reports (user_id, workspace_id, title, markdown)
      VALUES ($1, $2, $3, $4)
      RETURNING id, workspace_id, title, markdown, created_at
    `,
    [userId, resolvedWorkspaceId, title, markdown],
  );

  return {
    id: result.rows[0].id,
    workspaceId: result.rows[0].workspace_id,
    title: result.rows[0].title,
    markdown: result.rows[0].markdown,
    createdAt: toIso(result.rows[0].created_at),
  };
}

export async function createAgentTask({
  userId,
  workspaceId,
  title,
  detail,
}: {
  userId: string;
  workspaceId?: string;
  title: string;
  detail: string | null;
}) {
  const pool = await requireAgentPool();
  const resolvedWorkspaceId =
    workspaceId ?? (await ensureDefaultWorkspaceForUser(pool, userId));
  const result = await pool.query<TaskRow>(
    `
      INSERT INTO agent_tasks (user_id, workspace_id, title, detail)
      VALUES ($1, $2, $3, $4)
      RETURNING id, workspace_id, title, detail, created_at
    `,
    [userId, resolvedWorkspaceId, title, detail],
  );

  return {
    id: result.rows[0].id,
    workspaceId: result.rows[0].workspace_id,
    title: result.rows[0].title,
    detail: result.rows[0].detail,
    createdAt: toIso(result.rows[0].created_at),
  };
}

export async function rememberAgentRun({
  userId,
  workspaceId,
  userRequest,
  answer,
}: {
  userId: string;
  workspaceId: string;
  userRequest: string;
  answer: string;
}) {
  const content = [`User goal: ${userRequest}`, `Agent result: ${answer.slice(0, 800)}`]
    .join("\n")
    .slice(0, 1400);

  await setMemory(workspaceId, userId, "last_agent_run", content, "agent");
}
