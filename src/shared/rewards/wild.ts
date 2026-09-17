import { rollDrops, type DropPool } from '../drops';
import { WILD_REGIONS } from '../engine/combat-v6/wild/content';
import type { ItemGrant } from '../inventory';
import { BOOKS } from '../items/definitions/beast-books';
import { compileWildRewardPool } from './wild-pack';

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
