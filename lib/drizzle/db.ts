import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { cache } from 'react';
import * as schema from './schema';

export type DbRuntime = 'node' | 'worker';

const getRunTime = (): DbRuntime => {
  return process.env.DB_RUNTIME === 'worker' ? 'worker' : 'node';
};

const getConnectionString = (): string => {
  const runtime: DbRuntime = getRunTime();
  if (runtime === 'node') {
    return process.env.DATABASE_URL;
  }
  const { env } = getCloudflareContext();
  return env.HYPERDRIVE.connectionString;
};

export const db = cache(() => {
  const runtime: DbRuntime = getRunTime();
  const connectionString = getConnectionString();
  const client = postgres(connectionString, {
    prepare: false,
    max: runtime === 'worker' ? 1 : undefined,
  });
  return drizzle(client, { schema });
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
