import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { cache } from 'react';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

export const db = cache(() => {
  const client = postgres(connectionString, {
    prepare: false,
    max: 1,
    connect_timeout: 8,
    idle_timeout: 20,
  });
  return drizzle(client, { schema });
});

export type DbTransaction = Parameters<
  Parameters<ReturnType<typeof db>['transaction']>[0]
>[0];
