import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run drizzle-kit');
}

export default defineConfig({
  out: './drizzle',
  dialect: 'postgresql',
  schema: './apps/api/src/lib/drizzle/schema.ts',
  tablesFilter: ['wanjiedaoyou_*'],
  dbCredentials: {
    url: databaseUrl,
  },
});
