import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { WorkspacePermissionError } from "../../../../../lib/workspace/workspace";

const authMock = vi.hoisted(() => vi.fn());
const assertMemberMock = vi.hoisted(() => vi.fn());
const createScheduleMock = vi.hoisted(() => vi.fn());
const getSchedulesMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../../lib/auth", () => ({
  auth: authMock,
}));

vi.mock("../../../../../lib/workspace/workspace", async () => {
  const actual = await vi.importActual<typeof import("../../../../../lib/workspace/workspace")>(
    "../../../../../lib/workspace/workspace",
  );

  return {
    ...actual,
    assertMember: assertMemberMock,
  };
});

vi.mock("../../../../../lib/agent/scheduler", () => ({
  createSchedule: createScheduleMock,
  getSchedules: getSchedulesMock,
}));

describe("/api/workspaces/[id]/schedules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    assertMemberMock.mockResolvedValue({ id: "workspace-1" });
    createScheduleMock.mockResolvedValue({ id: "schedule-1" });
    getSchedulesMock.mockResolvedValue([]);
  });

  it("returns 403 when listing schedules for a non-member", async () => {
    assertMemberMock.mockRejectedValueOnce(new WorkspacePermissionError());

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "workspace-1" }),
    });

    expect(response.status).toBe(403);
    expect(getSchedulesMock).not.toHaveBeenCalled();
  });

  it("creates schedules after checking workspace membership", async () => {
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          name: "Daily summary",
          prompt: "Summarize yesterday",
          cron: "0 8 * * *",
        }),
      }),
      { params: Promise.resolve({ id: "workspace-1" }) },
    );

    expect(response.status).toBe(201);
    expect(assertMemberMock).toHaveBeenCalledWith("workspace-1", "user-1");
    expect(createScheduleMock).toHaveBeenCalledWith(
      "workspace-1",
      "user-1",
      "Daily summary",
      "Summarize yesterday",
      "0 8 * * *",
    );
  });
});
