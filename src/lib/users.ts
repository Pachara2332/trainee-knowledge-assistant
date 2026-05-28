import bcrypt from "bcryptjs";
import { getPool, type PoolLike } from "../db/pool";

type UserRecord = {
  id: string;
  email: string;
  password_hash: string | null;
  name: string | null;
};

const globalForPg = globalThis as typeof globalThis & {
  usersTableReady?: boolean;
};

async function ensureUsersTable(pool: PoolLike) {
  if (globalForPg.usersTableReady) {
    return;
  }

  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  try {
    await pool.query("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL");
  } catch (error) {
    console.error("[db] failed to alter password_hash column", error);
  }

  globalForPg.usersTableReady = true;
}

export async function findUserByEmail(email: string) {
  const pool = await getPool();

  if (!pool) {
    return null;
  }

  try {
    await ensureUsersTable(pool);
    const result = await pool.query<UserRecord>(
      "SELECT id, email, password_hash, name FROM users WHERE email = $1 LIMIT 1",
      [email.trim().toLowerCase()],
    );

    return result.rows[0] ?? null;
  } catch (error) {
    console.error("Unable to read user from database", error);
    return null;
  }
}

export async function createUser({
  email,
  password,
  name,
}: {
  email: string;
  password: string;
  name?: string;
}) {
  const pool = await getPool();

  if (!pool) {
    throw new Error("Database is not configured.");
  }

  await ensureUsersTable(pool);

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    await pool.query(
      "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)",
      [normalizedEmail, passwordHash, name?.trim() || null],
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new Error("Email is already registered.");
    }

    throw error;
  }
}

export async function createOAuthUser({
  email,
  name,
}: {
  email: string;
  name?: string;
}) {
  const pool = await getPool();

  if (!pool) {
    throw new Error("Database is not configured.");
  }

  await ensureUsersTable(pool);

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const result = await pool.query<UserRecord>(
      "INSERT INTO users (email, password_hash, name) VALUES ($1, NULL, $2) RETURNING id, email, password_hash, name",
      [normalizedEmail, name?.trim() || null],
    );
    return result.rows[0];
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new Error("Email is already registered.");
    }

    throw error;
  }
}
