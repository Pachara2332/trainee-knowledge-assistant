import { CronExpressionParser } from "cron-parser";
import { getPool } from "../../db/pool";
import { ensureAgentScheduleSchema } from "../db/schema";

export type AgentSchedule = {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  prompt: string;
  cron: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
};

type AgentScheduleRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  prompt: string;
  cron: string;
  enabled: boolean;
  last_run_at: Date | null;
  next_run_at: Date | null;
  created_at: Date;
};

export type SchedulePatch = {
  name?: string;
  prompt?: string;
  cron?: string;
  enabled?: boolean;
};

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function mapSchedule(row: AgentScheduleRow): AgentSchedule {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    name: row.name,
    prompt: row.prompt,
    cron: row.cron,
    enabled: row.enabled,
    lastRunAt: toIso(row.last_run_at),
    nextRunAt: toIso(row.next_run_at),
    createdAt: row.created_at.toISOString(),
  };
}

async function requireSchedulePool() {
  const pool = await getPool();

  if (!pool) {
    throw new Error("Database is not configured.");
  }

  await ensureAgentScheduleSchema(pool);
  return pool;
}

function requireText(value: string, label: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }

  return trimmed;
}

export function computeNextRunAt(cron: string, currentDate: Date = new Date()) {
  return CronExpressionParser.parse(requireText(cron, "Cron expression"), {
    currentDate,
  }).next().toDate();
}

export async function createSchedule(
  workspaceId: string,
  userId: string,
  name: string,
  prompt: string,
  cron: string,
) {
  const pool = await requireSchedulePool();
  const trimmedName = requireText(name, "Schedule name");
  const trimmedPrompt = requireText(prompt, "Schedule prompt");
  const trimmedCron = requireText(cron, "Cron expression");
  const nextRunAt = computeNextRunAt(trimmedCron);
  const result = await pool.query<AgentScheduleRow>(
    `
      INSERT INTO agent_schedules (workspace_id, user_id, name, prompt, cron, next_run_at)
      VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)
      RETURNING id, workspace_id, user_id, name, prompt, cron, enabled, last_run_at, next_run_at, created_at
    `,
    [workspaceId, userId, trimmedName, trimmedPrompt, trimmedCron, nextRunAt],
  );

  return mapSchedule(result.rows[0]);
}

export async function getSchedules(workspaceId: string) {
  const pool = await requireSchedulePool();
  const result = await pool.query<AgentScheduleRow>(
    `
      SELECT id, workspace_id, user_id, name, prompt, cron, enabled, last_run_at, next_run_at, created_at
      FROM agent_schedules
      WHERE workspace_id = $1::uuid
      ORDER BY created_at DESC
    `,
    [workspaceId],
  );

  return result.rows.map(mapSchedule);
}

export async function updateSchedule(
  id: string,
  workspaceId: string,
  patch: SchedulePatch,
) {
  const pool = await requireSchedulePool();
  const normalized: Required<SchedulePatch> = {
    name: typeof patch.name === "string" ? requireText(patch.name, "Schedule name") : "",
    prompt: typeof patch.prompt === "string" ? requireText(patch.prompt, "Schedule prompt") : "",
    cron: typeof patch.cron === "string" ? requireText(patch.cron, "Cron expression") : "",
    enabled: typeof patch.enabled === "boolean" ? patch.enabled : false,
  };
  const hasName = typeof patch.name === "string";
  const hasPrompt = typeof patch.prompt === "string";
  const hasCron = typeof patch.cron === "string";
  const hasEnabled = typeof patch.enabled === "boolean";

  if (!hasName && !hasPrompt && !hasCron && !hasEnabled) {
    throw new Error("No schedule fields were provided.");
  }

  const nextRunAt = hasCron ? computeNextRunAt(normalized.cron) : null;
  const result = await pool.query<AgentScheduleRow>(
    `
      UPDATE agent_schedules
      SET name = CASE WHEN $3::boolean THEN $4 ELSE name END,
          prompt = CASE WHEN $5::boolean THEN $6 ELSE prompt END,
          cron = CASE WHEN $7::boolean THEN $8 ELSE cron END,
          enabled = CASE WHEN $9::boolean THEN $10 ELSE enabled END,
          next_run_at = CASE WHEN $7::boolean THEN $11 ELSE next_run_at END
      WHERE id = $1::uuid
        AND workspace_id = $2::uuid
      RETURNING id, workspace_id, user_id, name, prompt, cron, enabled, last_run_at, next_run_at, created_at
    `,
    [
      id,
      workspaceId,
      hasName,
      normalized.name,
      hasPrompt,
      normalized.prompt,
      hasCron,
      normalized.cron,
      hasEnabled,
      normalized.enabled,
      nextRunAt,
    ],
  );

  if (!result.rows[0]) {
    throw new Error("Schedule not found.");
  }

  return mapSchedule(result.rows[0]);
}

export async function deleteSchedule(id: string, workspaceId: string) {
  const pool = await requireSchedulePool();
  await pool.query(
    `
      DELETE FROM agent_schedules
      WHERE id = $1::uuid
        AND workspace_id = $2::uuid
    `,
    [id, workspaceId],
  );
}

export async function getDueSchedules() {
  const pool = await requireSchedulePool();
  const result = await pool.query<AgentScheduleRow>(
    `
      SELECT id, workspace_id, user_id, name, prompt, cron, enabled, last_run_at, next_run_at, created_at
      FROM agent_schedules
      WHERE enabled = TRUE
        AND next_run_at IS NOT NULL
        AND next_run_at <= NOW()
      ORDER BY next_run_at ASC
      LIMIT 25
    `,
  );

  return result.rows.map(mapSchedule);
}

export async function updateNextRun(id: string, cron: string) {
  const pool = await requireSchedulePool();
  const nextRunAt = computeNextRunAt(cron);
  const result = await pool.query<AgentScheduleRow>(
    `
      UPDATE agent_schedules
      SET last_run_at = NOW(),
          next_run_at = $2
      WHERE id = $1::uuid
      RETURNING id, workspace_id, user_id, name, prompt, cron, enabled, last_run_at, next_run_at, created_at
    `,
    [id, nextRunAt],
  );

  if (!result.rows[0]) {
    throw new Error("Schedule not found.");
  }

  return mapSchedule(result.rows[0]);
}
