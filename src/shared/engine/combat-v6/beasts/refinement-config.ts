import { z } from 'zod';
import { REALM_VALUES } from '../../../types/constants';
import data from './data/refinement.json';

export const BeastRefinementPackShape = z.strictObject({
  $schema: z.string().optional(),
  formatVersion: z.literal(1),
  contentRevision: z.number().int().positive(),
  resetLevel: z.literal(0),
  resetExperience: z.literal(0),
  restoreLifespan: z.boolean(),
  items: z
    .array(
      z.strictObject({
        id: z.string().regex(/^beast\.refinement\.[a-z-]+$/),
        name: z.string().min(1).max(40),
        icon: z.literal('origin-dew'),
        color: z.enum(['jade', 'gold']),
        description: z.string().min(1).max(300),
        allowedRealms: z.array(z.enum(REALM_VALUES)).min(1),
        consumeQuantity: z.number().int().min(1).max(99),
        stackLimit: z.number().int().min(1).max(99),
      }),
    )
    .min(1),
});
export function loadBeastRefinementPack(input: unknown) {
  const pack = BeastRefinementPackShape.parse(input);
  if (new Set(pack.items.map((item) => item.id)).size !== pack.items.length)
    throw new Error('refinement.json：道具ID重复');
  for (const item of pack.items)
    if (
      item.consumeQuantity > item.stackLimit ||
      new Set(item.allowedRealms).size !== item.allowedRealms.length
    )
      throw new Error(`refinement.json：${item.id} 消耗数量或适用境界配置无效`);
  return pack;
}
export const BEAST_REFINEMENT = loadBeastRefinementPack(data);
