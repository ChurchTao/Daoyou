import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import { FIXED_MATERIALS } from '../items/definitions/fixed-materials';
import raw from './data/dungeon.json';

const integer = z.number().int().min(0).max(1000000);
const source = z.strictObject({ chance: z.number().min(0).max(1), experience: integer, stones: integer, quantity: integer.min(1).max(99) });
export const DungeonRewardPackShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1), contentRevision: integer.min(1),
  materials: z.array(z.strictObject({ rewardId: z.string().min(1), weight: integer.min(1) })).min(1),
  sources: z.strictObject({ exploration: source, battle: source, completion: source }),
});
export function loadDungeonRewardPack(data: unknown) {
  const result = DungeonRewardPackShape.superRefine((pack, ctx) => {
    const seen = new Set<string>();
    pack.materials.forEach((item, i) => {
      if (!FIXED_MATERIALS.some(m => m.id === item.rewardId) || seen.has(item.rewardId)) ctx.addIssue({ code: 'custom', path: ['materials', i, item.rewardId], message: '材料引用不存在或重复' });
      seen.add(item.rewardId);
    });
    if (!Number.isSafeInteger(pack.materials.reduce((sum, item) => sum + item.weight, 0))) ctx.addIssue({ code: 'custom', path: ['materials'], message: '权重总和溢出' });
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('rewards/data/dungeon.json', data, result.error.issues));
  return result.data;
}
export const DUNGEON_REWARD_PACK = loadDungeonRewardPack(raw);
