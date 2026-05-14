import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run drizzle-kit');
}

export default defineConfig({
  out: './drizzle',
  dialect: 'postgresql',
  schema: './src/server/lib/drizzle/schema.ts',
  tablesFilter: ['wanjiedaoyou_*'],
  dbCredentials: {
    url: databaseUrl,
  },
});
