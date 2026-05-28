type QueryResult<T> = {
  rows: T[];
};

export type PoolLike = {
  query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
};

const globalForPg = globalThis as typeof globalThis & {
  pgPool?: PoolLike;
};

export async function getPool() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!globalForPg.pgPool) {
    const { Pool } = await import("pg");
    globalForPg.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  return globalForPg.pgPool;
}
