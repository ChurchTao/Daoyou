import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import { DropPoolSchema, type DropPool } from '../drops';
import { DAO_EQUIPMENT_SLOTS, type DaoEquipmentSlot } from '../engine/combat-v6/equipment/types';
import { CHARACTER_MANUALS_V1 } from '../engine/combat-v6/manuals/content';
import { WILD_REGION } from '../engine/combat-v6/wild/content';
import { MANUAL_JADES } from '../items/definitions/manual-jades';
import { findItemDefinition } from '../items/registry';
import raw from './data/wild.json';

export const WILD_EQUIPMENT_REWARDS = new Map<string, { slot: DaoEquipmentSlot; level: number }>(
  Array.from({ length: 18 }, (_, i) => (i + 1) * 10).flatMap(level => DAO_EQUIPMENT_SLOTS.map(slot => [`equipment.${slot}.${level}`, { slot, level }] as const)),
);
const quantity = z.strictObject({ min: z.number().int().min(1).max(99), max: z.number().int().min(1).max(99) });
export const WildRewardPackShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1), contentRevision: z.number().int().positive(),
  nodeId: z.string().min(1), poolId: z.string().min(1), poolVersion: z.number().int().positive(),
  equipmentLevels: z.array(z.number().int().min(10).max(180).multipleOf(10)).min(1),
  groups: z.array(z.strictObject({
    id: z.string().min(1), chance: z.number().min(0).max(1),
    source: z.discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('fixed'), entries: z.array(z.strictObject({ rewardId: z.string().min(1), weight: z.number().positive().max(1000000), quantity })).min(1) }),
      z.strictObject({ kind: z.enum(['equipment', 'blueprints']), slots: z.array(z.enum(DAO_EQUIPMENT_SLOTS)).min(1) }),
      z.strictObject({ kind: z.literal('manualJades') }),
    ]),
  })).min(1),
});
function compilePool(pack: z.infer<typeof WildRewardPackShape>): DropPool {
  const entry = (rewardId: string, weight = 1) => ({ rewardId, weight, quantity: { min: 1, max: 1 } });
  return {
    id: pack.poolId, version: pack.poolVersion,
    groups: pack.groups.map(group => {
      const source = group.source;
      const entries = source.kind === 'fixed' ? source.entries
        : source.kind === 'manualJades' ? MANUAL_JADES.map(jade => entry(jade.id, CHARACTER_MANUALS_V1.find(m => m.id === jade.manualId)!.dropWeight))
          : pack.equipmentLevels.flatMap(level => source.slots.map(slot => entry(`${source.kind === 'blueprints' ? 'blueprint' : 'equipment'}.${slot}.${level}`)));
      return { id: group.id, chance: group.chance, entries };
    }),
  };
}
export function loadWildRewardPack(data: unknown) {
  const result = WildRewardPackShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    if (pack.nodeId !== WILD_REGION.nodeId) issue(['nodeId'], '引用未知野外区域');
    if (new Set(pack.equipmentLevels).size !== pack.equipmentLevels.length) issue(['equipmentLevels'], '装备等级重复');
    pack.groups.forEach((group, i) => {
      if ('slots' in group.source && new Set(group.source.slots).size !== group.source.slots.length) issue(['groups', i, group.id, 'source', 'slots'], '装备部位重复');
    });
    const pool = compilePool(pack);
    const valid = DropPoolSchema.safeParse(pool);
    if (!valid.success) for (const error of valid.error.issues) issue(error.path as (string | number)[], error.message);
    pool.groups.forEach((group, i) => {
      const seen = new Set<string>();
      group.entries.forEach((entry, j) => {
        const definition = findItemDefinition(entry.rewardId);
        const item = definition && entry.quantity.max <= 99 && definition.id !== 'equipment.v6' && definition.id !== 'material.v1';
        const equipment = WILD_EQUIPMENT_REWARDS.has(entry.rewardId) && entry.quantity.min === 1 && entry.quantity.max === 1;
        if ((!item && !equipment) || seen.has(entry.rewardId)) issue(['groups', i, group.id, 'entries', j, entry.rewardId], '奖励引用无效或重复');
        seen.add(entry.rewardId);
      });
    });
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('rewards/data/wild.json', data, result.error.issues));
  return result.data;
}
export const WILD_REWARD_PACK = loadWildRewardPack(raw);
export function compileWildRewardPool(pack = WILD_REWARD_PACK): DropPool {
  return DropPoolSchema.parse(compilePool(pack));
}
