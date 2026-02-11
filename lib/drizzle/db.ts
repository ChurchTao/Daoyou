import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { cache } from 'react';
import * as schema from './schema';

export const getDb = cache(() => {
  const client = postgres(process.env.DATABASE_URL!, {
    prepare: false,
  });
  return drizzle(client, { schema });
});

const client = postgres(process.env.DATABASE_URL!, {
  prepare: false,
});

const dbInstance = drizzle(client, { schema });

export const db = () => {
  return dbInstance;
};

export type DbTransaction = Parameters<
  Parameters<ReturnType<typeof db>['transaction']>[0]
>[0];
