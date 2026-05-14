import type { AuthUser } from '@server/lib/auth/types';
import type { DbExecutor } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';

export type ActiveCultivator = typeof cultivators.$inferSelect;

export type AppVariables = {
  user: AuthUser;
  cultivator: ActiveCultivator;
  executor: DbExecutor;
  validatedJson: unknown;
  validatedQuery: unknown;
};

export type AppEnv = {
  Variables: Partial<AppVariables>;
};
