import { getPool, type PoolLike } from "../../db/pool";
import {
  ensureDefaultWorkspaceForUser,
  ensureWorkspaceTables,
} from "../db/schema";

export type WorkspaceRole = "owner" | "admin" | "member";

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
  role: WorkspaceRole;
};

export type WorkspaceMember = {
  userId: string;
  email: string;
  name: string | null;
  role: WorkspaceRole;
  joinedAt: string;
};

export class WorkspacePermissionError extends Error {
  constructor(message = "Workspace access denied.") {
    super(message);
    this.name = "WorkspacePermissionError";
  }
}

type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: Date;
  role: WorkspaceRole;
};

type MemberRow = {
  user_id: string;
  email: string;
  name: string | null;
  role: WorkspaceRole;
  joined_at: Date;
};

function toIso(value: Date) {
  return value.toISOString();
}

function toWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    ownerId: row.owner_id,
    createdAt: toIso(row.created_at),
    role: row.role,
  };
}

function toMember(row: MemberRow): WorkspaceMember {
  return {
    userId: row.user_id,
    email: row.email,
    name: row.name,
    role: row.role,
    joinedAt: toIso(row.joined_at),
  };
}

function slugify(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return slug || "workspace";
}

function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return value === "owner" || value === "admin" || value === "member";
}

async function requireWorkspacePool() {
  const pool = await getPool();

  if (!pool) {
    throw new Error("Database is not configured.");
  }

  await ensureWorkspaceTables(pool);
  return pool;
}

async function uniqueSlug(pool: PoolLike, name: string) {
  const base = slugify(name);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const existing = await pool.query<{ id: string }>(
      "SELECT id FROM workspaces WHERE slug = $1 LIMIT 1",
      [slug],
    );

    if (existing.rows.length === 0) {
      return slug;
    }
  }

  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function createWorkspace(userId: string, name: string) {
  const pool = await requireWorkspacePool();
  const workspaceName = name.trim() || "Workspace";
  const slug = await uniqueSlug(pool, workspaceName);
  const result = await pool.query<WorkspaceRow>(
    `
      INSERT INTO workspaces (name, slug, owner_id)
      VALUES ($1, $2, $3::uuid)
      RETURNING id, name, slug, owner_id, created_at, 'owner'::workspace_role AS role
    `,
    [workspaceName, slug, userId],
  );
  const workspace = result.rows[0];

  await pool.query(
    `
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ($1::uuid, $2::uuid, 'owner'::workspace_role)
      ON CONFLICT (workspace_id, user_id) DO UPDATE
      SET role = 'owner'::workspace_role
    `,
    [workspace.id, userId],
  );

  return toWorkspace(workspace);
}

export async function getUserWorkspaces(userId: string) {
  const pool = await requireWorkspacePool();
  let result = await pool.query<WorkspaceRow>(
    `
      SELECT
        workspaces.id,
        workspaces.name,
        workspaces.slug,
        workspaces.owner_id,
        workspaces.created_at,
        workspace_members.role
      FROM workspaces
      INNER JOIN workspace_members
        ON workspace_members.workspace_id = workspaces.id
      WHERE workspace_members.user_id = $1::uuid
      ORDER BY workspaces.created_at ASC
    `,
    [userId],
  );

  if (result.rows.length === 0) {
    await ensureDefaultWorkspaceForUser(pool, userId);
    result = await pool.query<WorkspaceRow>(
      `
        SELECT
          workspaces.id,
          workspaces.name,
          workspaces.slug,
          workspaces.owner_id,
          workspaces.created_at,
          workspace_members.role
        FROM workspaces
        INNER JOIN workspace_members
          ON workspace_members.workspace_id = workspaces.id
        WHERE workspace_members.user_id = $1::uuid
        ORDER BY workspaces.created_at ASC
      `,
      [userId],
    );
  }

  return result.rows.map(toWorkspace);
}

export async function getWorkspaceById(id: string, userId: string) {
  const pool = await requireWorkspacePool();
  const result = await pool.query<WorkspaceRow>(
    `
      SELECT
        workspaces.id,
        workspaces.name,
        workspaces.slug,
        workspaces.owner_id,
        workspaces.created_at,
        workspace_members.role
      FROM workspaces
      INNER JOIN workspace_members
        ON workspace_members.workspace_id = workspaces.id
      WHERE workspaces.id = $1::uuid
        AND workspace_members.user_id = $2::uuid
      LIMIT 1
    `,
    [id, userId],
  );

  if (!result.rows[0]) {
    throw new WorkspacePermissionError();
  }

  return toWorkspace(result.rows[0]);
}

export async function assertMember(workspaceId: string, userId: string) {
  return getWorkspaceById(workspaceId, userId);
}

export async function addMember(
  workspaceId: string,
  email: string,
  role: WorkspaceRole,
) {
  if (!isWorkspaceRole(role)) {
    throw new Error("Invalid workspace role.");
  }

  const pool = await requireWorkspacePool();
  const user = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE email = $1 LIMIT 1",
    [email.trim().toLowerCase()],
  );

  if (!user.rows[0]) {
    throw new Error("User not found.");
  }

  const result = await pool.query<MemberRow>(
    `
      WITH upserted AS (
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES ($1::uuid, $2::uuid, $3::workspace_role)
        ON CONFLICT (workspace_id, user_id) DO UPDATE
        SET role = EXCLUDED.role
        RETURNING user_id, role, joined_at
      )
      SELECT
        upserted.user_id,
        users.email,
        users.name,
        upserted.role,
        upserted.joined_at
      FROM upserted
      INNER JOIN users ON users.id = upserted.user_id
    `,
    [workspaceId, user.rows[0].id, role],
  );

  return toMember(result.rows[0]);
}

export async function removeMember(workspaceId: string, userId: string) {
  const pool = await requireWorkspacePool();
  const workspace = await pool.query<{ owner_id: string }>(
    "SELECT owner_id FROM workspaces WHERE id = $1::uuid LIMIT 1",
    [workspaceId],
  );

  if (workspace.rows[0]?.owner_id === userId) {
    throw new Error("Workspace owner cannot be removed.");
  }

  await pool.query(
    `
      DELETE FROM workspace_members
      WHERE workspace_id = $1::uuid
        AND user_id = $2::uuid
    `,
    [workspaceId, userId],
  );
}

export async function getWorkspaceMembers(workspaceId: string) {
  const pool = await requireWorkspacePool();
  const result = await pool.query<MemberRow>(
    `
      SELECT
        users.id AS user_id,
        users.email,
        users.name,
        workspace_members.role,
        workspace_members.joined_at
      FROM workspace_members
      INNER JOIN users ON users.id = workspace_members.user_id
      WHERE workspace_members.workspace_id = $1::uuid
      ORDER BY workspace_members.joined_at ASC
    `,
    [workspaceId],
  );

  return result.rows.map(toMember);
}

export async function renameWorkspace(workspaceId: string, name: string) {
  const pool = await requireWorkspacePool();
  const workspaceName = name.trim();

  if (!workspaceName) {
    throw new Error("Workspace name is required.");
  }

  const result = await pool.query<WorkspaceRow>(
    `
      UPDATE workspaces
      SET name = $2
      WHERE id = $1::uuid
      RETURNING id, name, slug, owner_id, created_at, 'owner'::workspace_role AS role
    `,
    [workspaceId, workspaceName],
  );

  if (!result.rows[0]) {
    throw new Error("Workspace not found.");
  }

  return toWorkspace(result.rows[0]);
}

export async function deleteWorkspace(workspaceId: string) {
  const pool = await requireWorkspacePool();
  await pool.query("DELETE FROM workspaces WHERE id = $1::uuid", [workspaceId]);
}
