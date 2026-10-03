import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  index,
  pgSchema,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const BETTER_AUTH_SCHEMA_NAME = 'better_auth';

const authSchema = pgSchema(BETTER_AUTH_SCHEMA_NAME);
const authTimestamp = (name: string) =>
  timestamp(name, { mode: 'date', withTimezone: true });

export const authUsers = authSchema.table('user', {
  id: uuid('id')
    .default(sql`pg_catalog.gen_random_uuid()`)
    .primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique('user_email_key'),
  emailVerified: boolean('emailVerified').notNull(),
  image: text('image'),
  role: text('role'),
  banned: boolean('banned').default(false),
  banReason: text('banReason'),
  banExpires: authTimestamp('banExpires'),
  createdAt: authTimestamp('createdAt').defaultNow().notNull(),
  updatedAt: authTimestamp('updatedAt').defaultNow().notNull(),
});

export const authSessions = authSchema.table(
  'session',
  {
    id: uuid('id')
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    expiresAt: authTimestamp('expiresAt').notNull(),
    token: text('token').notNull().unique('session_token_key'),
    createdAt: authTimestamp('createdAt').defaultNow().notNull(),
    updatedAt: authTimestamp('updatedAt').notNull(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    userId: uuid('userId').notNull(),
    impersonatedBy: text('impersonatedBy'),
  },
  (table) => [
    foreignKey({
      name: 'session_userId_fkey',
      columns: [table.userId],
      foreignColumns: [authUsers.id],
    }).onDelete('cascade'),
    index('session_userId_idx').on(table.userId),
  ],
);

export const authAccounts = authSchema.table(
  'account',
  {
    id: uuid('id')
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    userId: uuid('userId').notNull(),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    idToken: text('idToken'),
    accessTokenExpiresAt: authTimestamp('accessTokenExpiresAt'),
    refreshTokenExpiresAt: authTimestamp('refreshTokenExpiresAt'),
    scope: text('scope'),
    password: text('password'),
    createdAt: authTimestamp('createdAt').defaultNow().notNull(),
    updatedAt: authTimestamp('updatedAt').notNull(),
  },
  (table) => [
    foreignKey({
      name: 'account_userId_fkey',
      columns: [table.userId],
      foreignColumns: [authUsers.id],
    }).onDelete('cascade'),
    index('account_userId_idx').on(table.userId),
  ],
);

export const authVerifications = authSchema.table(
  'verification',
  {
    id: uuid('id')
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: authTimestamp('expiresAt').notNull(),
    createdAt: authTimestamp('createdAt').defaultNow().notNull(),
    updatedAt: authTimestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => [
    index('verification_identifier_idx').on(table.identifier),
  ],
);

export const authUsersRelations = relations(authUsers, ({ many }) => ({
  sessions: many(authSessions),
  accounts: many(authAccounts),
}));

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(authUsers, {
    fields: [authSessions.userId],
    references: [authUsers.id],
  }),
}));

export const authAccountsRelations = relations(authAccounts, ({ one }) => ({
  user: one(authUsers, {
    fields: [authAccounts.userId],
    references: [authUsers.id],
  }),
}));

export const betterAuthSchema = {
  user: authUsers,
  session: authSessions,
  account: authAccounts,
  verification: authVerifications,
  userRelations: authUsersRelations,
  sessionRelations: authSessionsRelations,
  accountRelations: authAccountsRelations,
};
