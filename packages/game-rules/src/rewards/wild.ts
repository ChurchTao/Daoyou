import { type DropPool } from '@daoyou/game-domain/rewards';
import { rollDrops } from '../drops/index.js';
import { WILD_REGIONS } from '@daoyou/game-content/combat/wild';
import type { ItemGrant } from '@daoyou/game-domain/inventory';
import { BOOKS } from '@daoyou/game-content/items/beasts';
import { compileWildRewardPool } from '@daoyou/game-content/rewards/wild';

export const WILD_INHERITANCE_POOL = compileWildRewardPool();
export const WILD_DROP_POOLS: Record<string, DropPool> = Object.fromEntries(
  WILD_REGIONS.map((region) => [region.nodeId, WILD_INHERITANCE_POOL]),
);
const bookIds = new Set(BOOKS.map((book) => book.id));

export function wildItemRewards(
  pool: DropPool,
  random: (stream: string) => () => number,
): ItemGrant[] {
  // 旧活动战局可能冻结了包含装备、材料的旧池；未结算奖励也只允许灵印。
  const groups = pool.groups
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) => bookIds.has(entry.rewardId)),
    }))
    .filter((group) => group.entries.length > 0);
  if (!groups.length) return [];
  return rollDrops({ ...pool, groups }, (group) =>
    random(`drop:${group}`),
  ).rewards.map((reward) => ({
    definitionId: reward.rewardId,
    quantity: reward.quantity,
  }));
}
