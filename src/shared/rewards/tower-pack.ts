import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import { FIXED_MATERIALS } from '../items/definitions/fixed-materials';
import raw from './data/tower.json';

const integer = z.number().int().min(0).max(1000000);
const reward = z.strictObject({ quantity: integer.min(1), spiritStonesPerLevel: integer, reputation: integer });
export const TowerRewardPackShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1), contentRevision: integer.min(1),
  materials: z.array(z.strictObject({ rewardId: z.string().min(1), weight: integer.min(1) })).min(1),
  milestones: z.strictObject({ C: reward, B: reward, A: reward, S: reward }),
});
export function loadTowerRewardPack(data: unknown) {
  const result = TowerRewardPackShape.superRefine((pack, ctx) => {
    const ids = new Set<string>();
    const valid = new Set<string>(FIXED_MATERIALS.map(m => m.id));
    pack.materials.forEach((entry, i) => {
      if (!valid.has(entry.rewardId) || ids.has(entry.rewardId)) ctx.addIssue({ code: 'custom', path: ['materials', i, entry.rewardId], message: '材料引用不存在或重复' });
      ids.add(entry.rewardId);
    });
    if (!Number.isSafeInteger(pack.materials.reduce((sum, e) => sum + e.weight, 0))) ctx.addIssue({ code: 'custom', path: ['materials'], message: '权重总和溢出' });
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('rewards/data/tower.json', data, result.error.issues));
  return result.data;
}
export const TOWER_REWARD_PACK = loadTowerRewardPack(raw);
