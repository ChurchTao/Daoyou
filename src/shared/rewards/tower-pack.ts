import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import raw from './data/tower.json';

const integer = z.number().int().min(0).max(1000000);
const reward = z.strictObject({
  quantity: integer.min(1).max(99),
  spiritStonesPerLevel: integer,
  reputation: integer,
});
export const TowerRewardPackShape = z.strictObject({
  $schema: z.string().optional(),
  formatVersion: z.literal(2),
  contentRevision: integer.min(1),
  milestones: z.strictObject({ C: reward, B: reward, A: reward, S: reward }),
});
export function loadTowerRewardPack(data: unknown) {
  const result = TowerRewardPackShape.safeParse(data);
  if (!result.success)
    throw new Error(
      formatContentPackErrors(
        'rewards/data/tower.json',
        data,
        result.error.issues,
      ),
    );
  return result.data;
}
export const TOWER_REWARD_PACK = loadTowerRewardPack(raw);
