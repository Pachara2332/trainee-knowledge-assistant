import { describe, expect, it } from "vitest";
import { collectionNameForWorkspace } from "./txt-rag";

describe("collectionNameForWorkspace", () => {
  it("uses a workspace-scoped Chroma collection name", () => {
    expect(collectionNameForWorkspace("workspace-123")).toBe(
      "workspace_workspace-123",
    );
  });

  it("sanitizes unsafe workspace id characters", () => {
    expect(collectionNameForWorkspace("team/id:alpha")).toBe(
      "workspace_team_id_alpha",
    );
  });
});
