import { REALM_VALUES } from '@shared/types/constants';
import { z } from 'zod';
export const InfiniteTowerBattleIdSchema = z.object({ battleId: z.uuid() });
export const InfiniteTowerLeaderboardQuerySchema = z.object({
  realm: z.enum(REALM_VALUES),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});
