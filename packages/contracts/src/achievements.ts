export type {
  AchievementDisplay,
  AchievementView,
} from '@daoyou/game-domain/achievements';

import { z } from 'zod';

export const ClaimAchievementRewardsSchema = z
  .object({
    achievementIds: z
      .array(z.string().min(1).max(160))
      .min(1)
      .max(200)
      .refine((ids) => new Set(ids).size === ids.length, '成就不可重复选择'),
  })
  .strict();
export type ClaimAchievementRewardsRequest = z.infer<
  typeof ClaimAchievementRewardsSchema
>;
export interface ClaimAchievementRewardsResult {
  claimedIds: string[];
  reputationGranted: number;
}
