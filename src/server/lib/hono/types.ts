import type { AuthUser } from '@server/lib/auth/types';
import type { DbExecutor } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';

export type ActiveCultivator = typeof cultivators.$inferSelect;

export type ActiveCultivatorRef = {
  userId: string;
  cultivatorId: string;
  status: 'active';
};

export type AppVariables = {
  user: AuthUser;
  cultivator: ActiveCultivator;
  activeCultivatorRef: ActiveCultivatorRef;
  executor: DbExecutor;
  llmConfig: {
    provider: string;
    apiKey: string;
    baseUrl: string | null;
    model: string;
    fastModel: string;
  };
  validatedJson: unknown;
  validatedQuery: unknown;
};

export type AppEnv = {
  Variables: Partial<AppVariables>;
};
