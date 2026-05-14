import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
const betterAuthSchema = process.env.BETTER_AUTH_DB_SCHEMA?.trim() || 'better_auth';

if (!connectionString) {
  throw new Error('Missing DATABASE_URL');
}

const globalForDb = globalThis as typeof globalThis & {
  __daoyouPgPool?: Pool;
  __daoyouDb?: ReturnType<typeof drizzle<typeof schema>>;
};

export const pgPool =
  globalForDb.__daoyouPgPool ??
  new Pool({
    connectionString,
    max: 4,
    idleTimeoutMillis: 20_000,
    options: `-c search_path=${betterAuthSchema},public`,
  });

const drizzleDb =
  globalForDb.__daoyouDb ?? drizzle(pgPool, { schema });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__daoyouPgPool = pgPool;
  globalForDb.__daoyouDb = drizzleDb;
}

export const db = () => drizzleDb;

export type DbClient = ReturnType<typeof db>;

export type DbTransaction = Parameters<
  Parameters<ReturnType<typeof db>['transaction']>[0]
>[0];

export type DbExecutor = DbClient | DbTransaction;

export function getExecutor(tx?: DbTransaction): DbExecutor {
  return tx ?? db();
}

export function getQueryConcurrency(): number {
  return 4;
}
