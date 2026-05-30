import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatMemoriesAsContext,
  searchMemories,
  setMemory,
  type AgentMemory,
} from "./memory";

const getPoolMock = vi.hoisted(() => vi.fn());
const ensureAgentMemorySchemaMock = vi.hoisted(() => vi.fn());

vi.mock("../../db/pool", () => ({
  getPool: getPoolMock,
}));

vi.mock("../db/schema", () => ({
  ensureAgentMemorySchema: ensureAgentMemorySchemaMock,
}));

function memory(overrides: Partial<AgentMemory>): AgentMemory {
  return {
    id: "memory-1",
    workspaceId: "workspace-1",
    userId: "user-1",
    key: "project_goal",
    value: "Build a workspace-aware agent platform.",
    source: "agent",
    createdAt: "2026-05-30T00:00:00.000Z",
    updatedAt: "2026-05-30T00:00:00.000Z",
    ...overrides,
  };
}

describe("formatMemoriesAsContext", () => {
  it("formats memory records for agent prompt injection", () => {
    expect(formatMemoriesAsContext([memory({})])).toContain(
      "project_goal (agent, updated 2026-05-30): Build a workspace-aware agent platform.",
    );
  });

  it("returns an explicit empty memory message", () => {
    expect(formatMemoriesAsContext([])).toBe(
      "No persistent memories are stored for this workspace yet.",
    );
  });
});

describe("agent memory persistence helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureAgentMemorySchemaMock.mockResolvedValue(undefined);
  });

  it("upserts memory by workspace and key", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "memory-1",
          workspace_id: "workspace-1",
          user_id: "user-1",
          key: "project_goal",
          value: "Updated goal",
          source: "agent",
          created_at: new Date("2026-05-30T00:00:00.000Z"),
          updated_at: new Date("2026-05-30T01:00:00.000Z"),
        },
      ],
    });
    getPoolMock.mockResolvedValue({ query });

    const result = await setMemory(
      "workspace-1",
      "user-1",
      "Project Goal",
      "Updated goal",
      "agent",
    );

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT (workspace_id, key) DO UPDATE"),
      ["workspace-1", "user-1", "project_goal", "Updated goal", "agent"],
    );
    expect(result.key).toBe("project_goal");
  });

  it("searches memories using keyword match patterns", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "memory-1",
          workspace_id: "workspace-1",
          user_id: "user-1",
          key: "project_goal",
          value: "Build RAG platform",
          source: "agent",
          created_at: new Date("2026-05-30T00:00:00.000Z"),
          updated_at: new Date("2026-05-30T00:00:00.000Z"),
        },
      ],
    });
    getPoolMock.mockResolvedValue({ query });

    const result = await searchMemories("workspace-1", "RAG platform");

    expect(query).toHaveBeenCalledWith(expect.stringContaining("ILIKE ANY"), [
      "workspace-1",
      ["%rag%", "%platform%"],
    ]);
    expect(result[0].value).toBe("Build RAG platform");
  });
});
