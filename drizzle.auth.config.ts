import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to manage Better Auth migrations');
}

export default defineConfig({
  out: './drizzle-auth',
  dialect: 'postgresql',
  schema: './apps/api/src/lib/auth/schema.ts',
  schemaFilter: ['better_auth'],
  migrations: {
    schema: 'drizzle',
    table: '__drizzle_auth_migrations',
  },
  dbCredentials: {
    url: databaseUrl,
  },
});
