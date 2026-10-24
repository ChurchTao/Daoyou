import * as schema from '@server/lib/drizzle/schema.js';

export type CreationProductRecord = typeof schema.creationProducts.$inferSelect;
export type CreationProductInsert = typeof schema.creationProducts.$inferInsert;
