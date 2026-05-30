import { getPool } from "../../db/pool";
import { ensureAgentRunSchema } from "../db/schema";
import { runAgent } from "./engine";
import { getDueSchedules, updateNextRun, type AgentSchedule } from "./scheduler";

async function recordAgentRun({
  schedule,
  result,
  status,
  error,
}: {
  schedule: AgentSchedule;
  result: string | null;
  status: "completed" | "failed";
  error?: string;
}) {
  const pool = await getPool();

  if (!pool) {
    return;
  }

  await ensureAgentRunSchema(pool);
  await pool.query(
    `
      INSERT INTO agent_runs (
        workspace_id,
        user_id,
        schedule_id,
        trigger,
        prompt,
        result,
        status,
        error,
        completed_at
      )
      VALUES ($1::uuid, $2::uuid, $3::uuid, 'schedule', $4, $5, $6, $7, NOW())
    `,
    [
      schedule.workspaceId,
      schedule.userId,
      schedule.id,
      schedule.prompt,
      result,
      status,
      error ?? null,
    ],
  );
}

export async function runDueSchedules() {
  const schedules = await getDueSchedules();

  for (const schedule of schedules) {
    try {
      const result = await runAgent({
        messages: [{ role: "user", content: schedule.prompt }],
        context: {
          userId: schedule.userId,
          workspaceId: schedule.workspaceId,
          workspaceRoot: process.cwd(),
        },
      });

      await recordAgentRun({
        schedule,
        result: result.answer,
        status: "completed",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Scheduled agent run failed.";
      await recordAgentRun({
        schedule,
        result: null,
        status: "failed",
        error: message,
      });
      console.error("[agent-cron] scheduled run failed", {
        scheduleId: schedule.id,
        workspaceId: schedule.workspaceId,
        error,
      });
    } finally {
      try {
        await updateNextRun(schedule.id, schedule.cron);
      } catch (error) {
        console.error("[agent-cron] failed to update next run", {
          scheduleId: schedule.id,
          error,
        });
      }
    }
  }

  return schedules.length;
}
