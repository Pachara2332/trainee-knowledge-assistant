import type { PoolLike } from "../../db/pool";

const DEFAULT_WORKSPACE_NAME = "Default Workspace";

function defaultWorkspaceSlugSql(userIdExpression: string) {
  return `'default-' || replace(${userIdExpression}::text, '-', '')`;
}

export async function ensureWorkspaceTables(pool: PoolLike) {
  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  await pool.query(`
    DO $$
    BEGIN
      CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'member');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workspace_members (
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role workspace_role NOT NULL DEFAULT 'member',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (workspace_id, user_id)
    )
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id)",
  );
}

export async function ensureDefaultWorkspacesForUsers(pool: PoolLike) {
  await pool.query(`
    INSERT INTO workspaces (name, slug, owner_id)
    SELECT
      '${DEFAULT_WORKSPACE_NAME}',
      ${defaultWorkspaceSlugSql("users.id")},
      users.id
    FROM users
    ON CONFLICT (slug) DO NOTHING
  `);
  await pool.query(`
    INSERT INTO workspace_members (workspace_id, user_id, role)
    SELECT workspaces.id, workspaces.owner_id, 'owner'::workspace_role
    FROM workspaces
    ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET role = CASE
      WHEN workspace_members.role = 'owner' THEN workspace_members.role
      ELSE EXCLUDED.role
    END
  `);
}

export async function ensureDefaultWorkspaceForUser(pool: PoolLike, userId: string) {
  await ensureWorkspaceTables(pool);
  const existing = await pool.query<{ id: string }>(
    `
      SELECT workspaces.id
      FROM workspaces
      INNER JOIN workspace_members
        ON workspace_members.workspace_id = workspaces.id
      WHERE workspace_members.user_id = $1::uuid
      ORDER BY
        CASE WHEN workspaces.owner_id = $1::uuid THEN 0 ELSE 1 END,
        workspaces.created_at ASC
      LIMIT 1
    `,
    [userId],
  );

  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const result = await pool.query<{ id: string }>(
    `
      INSERT INTO workspaces (name, slug, owner_id)
      VALUES ($1, 'default-' || replace($2::uuid::text, '-', ''), $2::uuid)
      ON CONFLICT (slug) DO UPDATE
      SET name = workspaces.name
      RETURNING id
    `,
    [DEFAULT_WORKSPACE_NAME, userId],
  );
  const workspaceId = result.rows[0].id;

  await pool.query(
    `
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ($1::uuid, $2::uuid, 'owner'::workspace_role)
      ON CONFLICT (workspace_id, user_id) DO UPDATE
      SET role = CASE
        WHEN workspace_members.role = 'owner' THEN workspace_members.role
        ELSE EXCLUDED.role
      END
    `,
    [workspaceId, userId],
  );

  return workspaceId;
}

export async function ensureConversationWorkspaceSchema(pool: PoolLike) {
  await ensureWorkspaceTables(pool);
  await ensureDefaultWorkspacesForUsers(pool);
  await pool.query(`
    DO $$
    BEGIN
      IF to_regclass('public.conversations') IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'conversations'
            AND column_name = 'workspace_id'
            AND data_type <> 'uuid'
        )
      THEN
        ALTER TABLE conversations ADD COLUMN IF NOT EXISTS workspace_uuid UUID;

        UPDATE conversations
        SET workspace_uuid = workspaces.id
        FROM workspaces
        WHERE conversations.workspace_uuid IS NULL
          AND workspaces.owner_id = conversations.user_id
          AND workspaces.slug = ${defaultWorkspaceSlugSql("conversations.user_id")};

        ALTER TABLE conversations ALTER COLUMN workspace_uuid SET NOT NULL;
        ALTER TABLE conversations DROP COLUMN workspace_id;
        ALTER TABLE conversations RENAME COLUMN workspace_uuid TO workspace_id;
      END IF;
    END $$;
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF to_regclass('public.conversations') IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'conversations_workspace_id_fkey'
        )
      THEN
        ALTER TABLE conversations
        ADD CONSTRAINT conversations_workspace_id_fkey
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
      END IF;
    END $$;
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_conversations_workspace_updated ON conversations(workspace_id, updated_at DESC)",
  );
}

export async function ensureWorkspaceColumn({
  pool,
  tableName,
  constraintName,
}: {
  pool: PoolLike;
  tableName: "agent_reports" | "agent_tasks" | "agent_runs";
  constraintName: string;
}) {
  await ensureWorkspaceTables(pool);
  await pool.query(`
    DO $$
    BEGIN
      IF to_regclass('public.${tableName}') IS NOT NULL THEN
        ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS workspace_id UUID;

        UPDATE ${tableName}
        SET workspace_id = workspaces.id
        FROM workspaces
        WHERE ${tableName}.workspace_id IS NULL
          AND workspaces.owner_id = ${tableName}.user_id
          AND workspaces.slug = ${defaultWorkspaceSlugSql(`${tableName}.user_id`)};

        ALTER TABLE ${tableName} ALTER COLUMN workspace_id SET NOT NULL;

        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = '${constraintName}'
        )
        THEN
          ALTER TABLE ${tableName}
          ADD CONSTRAINT ${constraintName}
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
        END IF;
      END IF;
    END $$;
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF to_regclass('public.${tableName}') IS NOT NULL THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_${tableName}_workspace_created ON ${tableName}(workspace_id, created_at DESC)';
      END IF;
    END $$;
  `);
}

export async function ensureAgentMemorySchema(pool: PoolLike) {
  await ensureWorkspaceTables(pool);
  await ensureDefaultWorkspacesForUsers(pool);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_memories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('agent', 'user', 'system')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, key)
    )
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF to_regclass('public.agent_memories') IS NOT NULL THEN
        ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS workspace_id UUID;
        ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS key TEXT;
        ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS value TEXT;
        ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'agent';
        ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

        UPDATE agent_memories
        SET workspace_id = workspaces.id
        FROM workspaces
        WHERE agent_memories.workspace_id IS NULL
          AND workspaces.owner_id = agent_memories.user_id
          AND workspaces.slug = ${defaultWorkspaceSlugSql("agent_memories.user_id")};

        UPDATE agent_memories
        SET key = 'legacy_run_' || replace(id::text, '-', '')
        WHERE key IS NULL;

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'agent_memories'
            AND column_name = 'content'
        )
        THEN
          UPDATE agent_memories
          SET value = content
          WHERE value IS NULL;
        END IF;

        UPDATE agent_memories SET value = '' WHERE value IS NULL;
        UPDATE agent_memories SET source = 'agent' WHERE source IS NULL;
        UPDATE agent_memories SET updated_at = created_at WHERE updated_at IS NULL;

        ALTER TABLE agent_memories ALTER COLUMN workspace_id SET NOT NULL;
        ALTER TABLE agent_memories ALTER COLUMN key SET NOT NULL;
        ALTER TABLE agent_memories ALTER COLUMN value SET NOT NULL;
        ALTER TABLE agent_memories ALTER COLUMN source SET NOT NULL;
        ALTER TABLE agent_memories ALTER COLUMN updated_at SET NOT NULL;

        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'agent_memories_workspace_id_fkey'
        )
        THEN
          ALTER TABLE agent_memories
          ADD CONSTRAINT agent_memories_workspace_id_fkey
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'agent_memories_source_check'
        )
        THEN
          ALTER TABLE agent_memories
          ADD CONSTRAINT agent_memories_source_check
          CHECK (source IN ('agent', 'user', 'system'));
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'agent_memories_workspace_key_unique'
        )
        THEN
          ALTER TABLE agent_memories
          ADD CONSTRAINT agent_memories_workspace_key_unique
          UNIQUE (workspace_id, key);
        END IF;
      END IF;
    END $$;
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_agent_memories_workspace_updated ON agent_memories(workspace_id, updated_at DESC)",
  );
}

export async function ensureAgentRunSchema(pool: PoolLike) {
  await ensureWorkspaceTables(pool);
  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      schedule_id UUID,
      trigger TEXT NOT NULL DEFAULT 'manual',
      prompt TEXT NOT NULL,
      result TEXT,
      status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF to_regclass('public.agent_runs') IS NOT NULL THEN
        ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS schedule_id UUID;
        ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS trigger TEXT DEFAULT 'manual';
        ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS prompt TEXT DEFAULT '';
        ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS result TEXT;
        ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
        ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS error TEXT;
        ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

        UPDATE agent_runs SET trigger = 'manual' WHERE trigger IS NULL;
        UPDATE agent_runs SET prompt = '' WHERE prompt IS NULL;
        UPDATE agent_runs SET status = 'completed' WHERE status IS NULL;

        ALTER TABLE agent_runs ALTER COLUMN trigger SET NOT NULL;
        ALTER TABLE agent_runs ALTER COLUMN prompt SET NOT NULL;
        ALTER TABLE agent_runs ALTER COLUMN status SET NOT NULL;
      END IF;
    END $$;
  `);
  await ensureWorkspaceColumn({
    pool,
    tableName: "agent_runs",
    constraintName: "agent_runs_workspace_id_fkey",
  });
  await pool.query(`
    DO $$
    BEGIN
      IF to_regclass('public.agent_schedules') IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'agent_runs_schedule_id_fkey'
        )
      THEN
        ALTER TABLE agent_runs
        ADD CONSTRAINT agent_runs_schedule_id_fkey
        FOREIGN KEY (schedule_id) REFERENCES agent_schedules(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_agent_runs_schedule_created ON agent_runs(schedule_id, created_at DESC)",
  );
}

export async function ensureAgentScheduleSchema(pool: PoolLike) {
  await ensureWorkspaceTables(pool);
  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      cron TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      last_run_at TIMESTAMPTZ,
      next_run_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_agent_schedules_workspace_created ON agent_schedules(workspace_id, created_at DESC)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_agent_schedules_due ON agent_schedules(enabled, next_run_at)",
  );
  await ensureAgentRunSchema(pool);
}
