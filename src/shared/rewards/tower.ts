import type {
  TowerReward,
  TowerRewardPreview,
} from '../contracts/combatV6Tower';
import { rollDrops } from '../drops';
import { SeededRng } from '../engine/combat-v6/core';
import {
  equipmentRealm,
  isOpenEquipmentLevel,
} from '../engine/combat-v6/equipment/realm';
import { combatCharacterLevel } from '../engine/combat-v6/projection/character-level';
import { itemDefinition } from '../inventory';
import { hashTowerSeed } from '../lib/tower/helpers';
import type { RealmType } from '../types/constants';
import { TOWER_REWARD_PACK } from './tower-pack';

function eligibleRewardItems(
  drop: (typeof TOWER_REWARD_PACK)['floors'][number]['drops'][number],
  realm: RealmType,
  pack: typeof TOWER_REWARD_PACK,
) {
  const ids =
    drop.source.kind === 'item'
      ? [drop.source.definitionId]
      : pack.pools[drop.source.poolId].entries;
  const level = combatCharacterLevel(realm, '初期');
  return ids.filter((id) => {
    const item = itemDefinition(id);
    return (
      item.kind !== 'blueprint' ||
      (isOpenEquipmentLevel(item.level!) &&
        equipmentRealm(item.level!).requiredLevel <= level)
    );
  });
}

export function towerRewardPreviews(
  realm: RealmType,
  pack = TOWER_REWARD_PACK,
): TowerRewardPreview[] {
  return pack.floors
    .map((row) => ({
      floor: row.floor,
      spiritStones:
        combatCharacterLevel(realm, '初期') * row.spiritStonesPerLevel,
      reputation: row.reputation,
      drops: row.drops.map((drop) => ({
        id: drop.id,
        random: drop.source.kind === 'pool',
        definitionIds: eligibleRewardItems(drop, realm, pack),
        chance: drop.chance,
        quantity: drop.quantity,
        label:
          drop.source.kind === 'item'
            ? itemDefinition(drop.source.definitionId).name
            : pack.pools[drop.source.poolId].label,
        realmLimited:
          drop.source.kind === 'pool' &&
          pack.pools[drop.source.poolId].kind === 'blueprint',
      })),
    }))
    .sort((a, b) => a.floor - b.floor);
}

/** Server supplies the run seed and admitted realm. Frozen receipts are never rerolled. */
export function planTowerReward(
  floor: number,
  seed: number,
  realm: RealmType,
  pack = TOWER_REWARD_PACK,
): TowerReward {
  const row = pack.floors.find((row) => row.floor === floor);
  if (!row) throw new Error('无效的幻境奖励楼层');
  const level = combatCharacterLevel(realm, '初期');
  const items: TowerReward['items'] = [];
  if (row.drops.length) {
    const result = rollDrops(
      {
        id: `tower.floor.${floor}`,
        version: pack.contentRevision,
        groups: row.drops.map((drop) => {
          const eligible = eligibleRewardItems(drop, realm, pack);
          return {
            id: drop.id,
            chance: drop.chance,
            entries: eligible.map((rewardId) => ({
              rewardId,
              weight: 1,
              quantity: { min: drop.quantity, max: drop.quantity },
            })),
          };
        }),
      },
      (group) => {
        const rng = new SeededRng(
          hashTowerSeed(
            `${seed}:tower:${floor}:${pack.contentRevision}:${group}`,
          ),
        );
        return () => rng.next();
      },
    );
    for (const reward of result.rewards) {
      const existing = items.find(
        (item) => item.definitionId === reward.rewardId,
      );
      if (existing) existing.quantity += reward.quantity;
      else
        items.push({
          definitionId: reward.rewardId,
          quantity: reward.quantity,
        });
    }
  }
  return {
    floor,
    spiritStones: level * row.spiritStonesPerLevel,
    reputation: row.reputation,
    items,
  };
}
