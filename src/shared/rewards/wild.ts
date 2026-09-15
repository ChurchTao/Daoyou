import { rollDrops, type DropPool } from '../drops';
import { generateForgedEquipment } from '../engine/combat-v6/equipment/forging';
import type { ItemGrant } from '../inventory';
import { findItemDefinition } from '../items/registry';
import { WILD_REWARD_PACK, WILD_EQUIPMENT_REWARDS, compileWildRewardPool } from './wild-pack';

export const QINGXI_EQUIPMENT_LEVELS = WILD_REWARD_PACK.equipmentLevels;
export const QINGXI_POOL_V2 = compileWildRewardPool();
export const WILD_DROP_POOLS: Record<string, DropPool> = { [WILD_REWARD_PACK.nodeId]: QINGXI_POOL_V2 };

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
    const spec = WILD_EQUIPMENT_REWARDS.get(reward.rewardId);
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
