import { DropPoolSchema, rollDrops, type DropPool } from '../drops';
import { generateForgedEquipment } from '../engine/combat-v6/equipment/forging';
import {
  DAO_EQUIPMENT_SLOTS,
  type DaoEquipmentSlot,
} from '../engine/combat-v6/equipment/types';
import { CHARACTER_MANUALS_V1 } from '../engine/combat-v6/manuals/content';
import type { ItemGrant } from '../inventory';
import { BOOKS } from '../items/definitions/beast-books';
import { FIXED_MATERIALS } from '../items/definitions/fixed-materials';
import { MANUAL_JADES } from '../items/definitions/manual-jades';
import { findItemDefinition } from '../items/registry';

// Business configuration: levels/slots/probabilities belong here, never in the drop engine.
export const QINGXI_EQUIPMENT_LEVELS = [10] as const;
const equipmentRewards = new Map<
  string,
  { slot: DaoEquipmentSlot; level: number }
>(
  Array.from({ length: 18 }, (_, i) => (i + 1) * 10).flatMap((level) =>
    DAO_EQUIPMENT_SLOTS.map(
      (slot) => [`equipment.${slot}.${level}`, { slot, level }] as const,
    ),
  ),
);
const entry = (rewardId: string, weight = 1) => ({
  rewardId,
  weight,
  quantity: { min: 1, max: 1 },
});
export const QINGXI_POOL_V2 = DropPoolSchema.parse({
  id: 'qingxi',
  version: 2,
  groups: [
    {
      id: 'materials',
      chance: 0.3,
      entries: FIXED_MATERIALS.map((m, i) => entry(m.id, [40, 25, 25, 10][i])),
    },
    {
      id: 'blueprints',
      chance: 0.08,
      entries: QINGXI_EQUIPMENT_LEVELS.flatMap((level) =>
        DAO_EQUIPMENT_SLOTS.map((slot) => entry(`blueprint.${slot}.${level}`)),
      ),
    },
    {
      id: 'equipment',
      chance: 0.01,
      entries: QINGXI_EQUIPMENT_LEVELS.flatMap((level) =>
        DAO_EQUIPMENT_SLOTS.map((slot) => entry(`equipment.${slot}.${level}`)),
      ),
    },
    {
      id: 'books',
      chance: 0.03,
      entries: BOOKS.map((book, i) => entry(book.id, i < 4 ? 24 : 4)),
    },
    {
      id: 'manuals',
      chance: 0.03,
      entries: MANUAL_JADES.map((jade) =>
        entry(
          jade.id,
          CHARACTER_MANUALS_V1.find((manual) => manual.id === jade.manualId)!
            .dropWeight,
        ),
      ),
    },
  ],
});
export const WILD_DROP_POOLS: Record<string, DropPool> = {
  SAT_TN_08: QINGXI_POOL_V2,
};
for (const pool of Object.values(WILD_DROP_POOLS)) {
  for (const group of pool.groups)
    for (const entry of group.entries) {
      const definition = findItemDefinition(entry.rewardId);
      if (
        definition &&
        entry.quantity.max <= 99 &&
        definition.id !== 'equipment.v6' &&
        definition.id !== 'material.v1'
      )
        continue;
      if (
        equipmentRewards.has(entry.rewardId) &&
        entry.quantity.min === 1 &&
        entry.quantity.max === 1
      )
        continue;
      throw new Error(`Invalid configured reward: ${entry.rewardId}`);
    }
}

/** Converts opaque rewards into immutable item facts; the drop engine has no such knowledge. */
export function wildItemRewards(
  pool: DropPool,
  random: (stream: string) => () => number,
  instanceId: (group: string) => string,
  createdAt: string,
): ItemGrant[] {
  const result = rollDrops(pool, (group) => random(`drop:${group}`));
  return result.rewards.map((reward) => {
    const definition = findItemDefinition(reward.rewardId);
    if (definition)
      return { definitionId: definition.id, quantity: reward.quantity };
    const spec = equipmentRewards.get(reward.rewardId);
    if (!spec || reward.quantity !== 1)
      throw new Error(`Unknown reward: ${reward.rewardId}`);
    const id = instanceId(reward.groupId);
    const generated = generateForgedEquipment({
      id,
      createdAt,
      seed: Math.floor(random(`equipment:${reward.groupId}`)() * 0x100000000),
      templateId: `dao_equipment.standard.${spec.slot}.v1`,
      equipmentLevel: spec.level,
      boosts: { ore: 0, attributes: 0, essence: 0 },
    });
    if (!generated.ok) throw new Error('Invalid equipment reward');
    return {
      definitionId: 'equipment.v6',
      quantity: 1,
      instanceData: generated.instance,
    };
  });
}
