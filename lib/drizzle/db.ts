import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { cache } from 'react';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

export const db = cache(() => {
  const pool = new Pool({
    connectionString: connectionString,
    // You don't want to reuse the same connection for multiple requests
    maxUses: 1,
  });
  return drizzle({ client: pool, schema });
});

export type DbTransaction = Parameters<
  Parameters<ReturnType<typeof db>['transaction']>[0]
>[0];
