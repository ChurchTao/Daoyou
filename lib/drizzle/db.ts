import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type DbRuntime = 'node' | 'worker';

export interface ResolvedDbConfig {
  runtime: DbRuntime;
  max: number;
  prepare: boolean;
  idle_timeout: number;
  debug: boolean;
}

interface DbConfigEnv {
  DB_RUNTIME?: string;
  DB_POOL_MAX?: string;
  DB_IDLE_TIMEOUT?: string;
  DB_PREPARE?: string;
  DB_DEBUG?: string;
  DB_QUERY_CONCURRENCY?: string;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (!raw) {
    return fallback;
  }
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

export function resolveDbConfig(
  env: DbConfigEnv = process.env as unknown as DbConfigEnv,
): ResolvedDbConfig {
  const runtime: DbRuntime = env.DB_RUNTIME === 'worker' ? 'worker' : 'node';
  const defaultMax = runtime === 'worker' ? 1 : 10;
  const defaultIdleTimeout = runtime === 'worker' ? 5 : 20;

  return {
    runtime,
    max: parsePositiveInt(env.DB_POOL_MAX, defaultMax),
    prepare: parseBoolean(env.DB_PREPARE, false),
    idle_timeout: parsePositiveInt(env.DB_IDLE_TIMEOUT, defaultIdleTimeout),
    debug: parseBoolean(env.DB_DEBUG, false),
  };
}

type DbClientInternal = PostgresJsDatabase<typeof schema>;

let singletonDb: DbClientInternal | null = null;

export const db = () => {
  if (singletonDb) {
    return singletonDb;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured');
  }

  const config = resolveDbConfig();
  const client = postgres(databaseUrl, {
    prepare: config.prepare,
    max: config.max,
    idle_timeout: config.idle_timeout,
    debug: config.debug,
  });

  singletonDb = drizzle(client, { schema });
  return singletonDb;
};

export type DbClient = ReturnType<typeof db>;

export type DbTransaction = Parameters<
  Parameters<ReturnType<typeof db>['transaction']>[0]
>[0];

export type DbExecutor = DbClient | DbTransaction;

export function getExecutor(tx?: DbTransaction): DbExecutor {
  return tx ?? db();
}

export function getQueryConcurrency(
  env: DbConfigEnv = process.env as unknown as DbConfigEnv,
): number {
  const runtime: DbRuntime = env.DB_RUNTIME === 'worker' ? 'worker' : 'node';
  const defaultConcurrency = runtime === 'worker' ? 1 : 4;
  return parsePositiveInt(env.DB_QUERY_CONCURRENCY, defaultConcurrency);
}
