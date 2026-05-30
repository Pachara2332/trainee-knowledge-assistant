import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { WorkspacePermissionError } from "../../../../../lib/workspace/workspace";

const authMock = vi.hoisted(() => vi.fn());
const assertMemberMock = vi.hoisted(() => vi.fn());
const getMemoriesMock = vi.hoisted(() => vi.fn());

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

vi.mock("../../../../../lib/agent/memory", () => ({
  getMemories: getMemoriesMock,
}));

describe("GET /api/workspaces/[id]/memories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    assertMemberMock.mockResolvedValue({ id: "workspace-1" });
    getMemoriesMock.mockResolvedValue([]);
  });

  it("returns 403 when the user is not a workspace member", async () => {
    assertMemberMock.mockRejectedValueOnce(new WorkspacePermissionError());

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "workspace-1" }),
    });

    expect(response.status).toBe(403);
    expect(getMemoriesMock).not.toHaveBeenCalled();
  });
});
