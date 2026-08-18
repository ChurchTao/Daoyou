import type { AuthUser } from '@server/lib/auth/types';
import type { LlmByokConfig } from '@shared/config/llm';
export type ActiveCultivatorRef = {
  userId: string;
  cultivatorId: string;
  status: 'active';
};

export type AppVariables = {
  user: AuthUser;
  activeCultivatorRef: ActiveCultivatorRef;
  llmConfig: LlmByokConfig;
  validatedJson: unknown;
  validatedQuery: unknown;
};

export type AppEnv = {
  Variables: Partial<AppVariables>;
};
