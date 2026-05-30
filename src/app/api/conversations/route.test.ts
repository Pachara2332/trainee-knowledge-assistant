import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { WorkspacePermissionError } from "../../../lib/workspace/workspace";

const authMock = vi.hoisted(() => vi.fn());
const assertMemberMock = vi.hoisted(() => vi.fn());
const getUserWorkspacesMock = vi.hoisted(() => vi.fn());
const listConversationsForUserMock = vi.hoisted(() => vi.fn());
const createConversationForUserMock = vi.hoisted(() => vi.fn());

vi.mock("../../../lib/auth", () => ({
  auth: authMock,
}));

vi.mock("../../../lib/workspace/workspace", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/workspace/workspace")>(
    "../../../lib/workspace/workspace",
  );

  return {
    ...actual,
    assertMember: assertMemberMock,
    getUserWorkspaces: getUserWorkspacesMock,
  };
});

vi.mock("../../../repositories/chat-history", () => ({
  listConversationsForUser: listConversationsForUserMock,
  createConversationForUser: createConversationForUserMock,
}));

describe("/api/conversations workspace boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    assertMemberMock.mockResolvedValue({ id: "workspace-1", role: "member" });
    getUserWorkspacesMock.mockResolvedValue([{ id: "workspace-1" }]);
    listConversationsForUserMock.mockResolvedValue([]);
    createConversationForUserMock.mockResolvedValue({
      id: "conversation-1",
      workspaceId: "workspace-1",
      messages: [],
    });
  });

  it("loads conversations for the selected workspace after membership check", async () => {
    await GET(new Request("http://localhost/api/conversations?workspaceId=workspace-1"));

    expect(assertMemberMock).toHaveBeenCalledWith("workspace-1", "user-1");
    expect(listConversationsForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      workspaceId: "workspace-1",
    });
  });

  it("creates conversations in the selected workspace", async () => {
    await POST(
      new Request("http://localhost/api/conversations", {
        method: "POST",
        body: JSON.stringify({ title: "Q3 review", workspaceId: "workspace-1" }),
      }),
    );

    expect(createConversationForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      title: "Q3 review",
      workspaceId: "workspace-1",
    });
  });

  it("returns 403 when a non-member tries to access workspace conversations", async () => {
    assertMemberMock.mockRejectedValueOnce(new WorkspacePermissionError());

    const response = await GET(
      new Request("http://localhost/api/conversations?workspaceId=workspace-2"),
    );

    expect(response.status).toBe(403);
    expect(listConversationsForUserMock).not.toHaveBeenCalled();
  });
});
