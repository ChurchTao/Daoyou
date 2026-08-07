/**
 * Reliable migration runner: uses drizzle-orm's migrator API directly instead
 * of the drizzle-kit CLI, which can silently fail on Windows PowerShell.
 *
 * Usage:
 *   bun --env-file=.env.local run scripts/run-migrations.ts
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is required. Run with: bun --env-file=.env.local run scripts/run-migrations.ts',
    );
  }

  const pool = new Pool({ connectionString, ssl: false });
  const db = drizzle(pool);

  console.log('[migrate] applying business table migrations from ./drizzle ...');

  await migrate(db, { migrationsFolder: './drizzle' });

  console.log('[migrate] business table migrations applied successfully.');

  const result = await pool.query(
    `SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`,
  );
  console.log(`[migrate] total migrations recorded: ${result.rows[0].count}`);

  const tables = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  console.log(`[migrate] tables in public schema (${tables.rows.length}):`);
  for (const row of tables.rows) {
    console.log(`  - ${row.tablename}`);
  }

  await pool.end();
}

main().catch((error) => {
  console.error('[migrate] failed:', error);
  process.exit(1);
});
