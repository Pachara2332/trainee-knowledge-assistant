import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeNextRunAt,
  createSchedule,
  getDueSchedules,
  updateSchedule,
} from "./scheduler";

const getPoolMock = vi.hoisted(() => vi.fn());
const ensureAgentScheduleSchemaMock = vi.hoisted(() => vi.fn());

vi.mock("../../db/pool", () => ({
  getPool: getPoolMock,
}));

vi.mock("../db/schema", () => ({
  ensureAgentScheduleSchema: ensureAgentScheduleSchemaMock,
}));

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "schedule-1",
    workspace_id: "workspace-1",
    user_id: "user-1",
    name: "Daily summary",
    prompt: "Summarize yesterday",
    cron: "0 8 * * *",
    enabled: true,
    last_run_at: null,
    next_run_at: new Date("2026-05-30T08:00:00.000Z"),
    created_at: new Date("2026-05-30T00:00:00.000Z"),
    ...overrides,
  };
}

describe("agent scheduler helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureAgentScheduleSchemaMock.mockResolvedValue(undefined);
  });

  it("computes the next run from a cron expression", () => {
    expect(
      computeNextRunAt("0 8 * * *", new Date("2026-05-30T00:30:00.000Z")).toISOString(),
    ).toBe("2026-05-30T01:00:00.000Z");
  });

  it("creates a schedule with a computed next_run_at", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row()] });
    getPoolMock.mockResolvedValue({ query });

    const result = await createSchedule(
      "workspace-1",
      "user-1",
      "Daily summary",
      "Summarize yesterday",
      "0 8 * * *",
    );

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO agent_schedules"),
      [
        "workspace-1",
        "user-1",
        "Daily summary",
        "Summarize yesterday",
        "0 8 * * *",
        expect.any(Date),
      ],
    );
    expect(result.workspaceId).toBe("workspace-1");
  });

  it("updates next_run_at when the cron expression changes", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [row({ cron: "0 9 * * *" })],
    });
    getPoolMock.mockResolvedValue({ query });

    await updateSchedule("schedule-1", "workspace-1", { cron: "0 9 * * *" });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("next_run_at = CASE WHEN $7::boolean THEN $11 ELSE next_run_at END"),
      expect.arrayContaining(["schedule-1", "workspace-1", true, "0 9 * * *", expect.any(Date)]),
    );
  });

  it("loads only enabled schedules that are due", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row()] });
    getPoolMock.mockResolvedValue({ query });

    await getDueSchedules();

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("AND next_run_at <= NOW()"),
    );
  });
});
