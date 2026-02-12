import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { cache } from 'react';
import * as schema from './schema';

export const db = cache(() => {
  const client = postgres(process.env.DATABASE_URL!, {
    prepare: false,
    max: 1,
  });
  return drizzle(client, { schema });
});

export type DbTransaction = Parameters<
  Parameters<ReturnType<typeof db>['transaction']>[0]
>[0];
