import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { cache } from 'react';
import * as schema from './schema';

export type DbRuntime = 'node' | 'worker';

export const db = cache(() => {
  const runtime: DbRuntime =
    process.env.DB_RUNTIME === 'worker' ? 'worker' : 'node';
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // You don't want to reuse the same connection for multiple requests
    maxUses: runtime === 'worker' ? 1 : undefined,
  });
  return drizzle({ client: pool, schema });
});

export type DbClient = ReturnType<typeof db>;

export type DbTransaction = Parameters<
  Parameters<ReturnType<typeof db>['transaction']>[0]
>[0];

export type DbExecutor = DbClient | DbTransaction;

export function getExecutor(tx?: DbTransaction): DbExecutor {
  return tx ?? db();
}

export function getQueryConcurrency(): number {
  const runtime: DbRuntime =
    process.env.DB_RUNTIME === 'worker' ? 'worker' : 'node';
  const defaultConcurrency = runtime === 'worker' ? 1 : 4;
  return defaultConcurrency;
}
