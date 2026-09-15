import type { TowerReward } from '../contracts/combatV6Tower';
import { rollDrops, type DropPool } from '../drops';
import { SeededRng } from '../engine/combat-v6/core';
import { combatCharacterLevel } from '../engine/combat-v6/projection/character-level';
import { TOWER_ENCOUNTER_PACK } from '../lib/tower/encounter-pack';
import { TOWER_REWARD_PACK } from './tower-pack';
import type { RealmType } from '../types/constants';

export function towerReward(
  floor: number,
  seed: number,
  realm: RealmType,
  pack = TOWER_REWARD_PACK,
): TowerReward | null {
  const tier = TOWER_ENCOUNTER_PACK.floors.find(row => row.floor === floor)?.milestone;
  if (!tier) return null;
  const reward = pack.milestones[tier];
  const pool: DropPool = {
    id: `tower.milestone.${floor}`,
    version: 1,
    groups: [
      {
        id: 'materials',
        chance: 1,
        entries: pack.materials.map((item) => ({
          rewardId: item.rewardId,
          weight: item.weight,
          quantity: { min: reward.quantity, max: reward.quantity },
        })),
      },
    ],
  };
  const rng = new SeededRng(seed);
  return {
    floor,
    items: rollDrops(pool, () => () => rng.next()).rewards.map((r) => ({
      definitionId: r.rewardId,
      quantity: r.quantity,
    })),
    spiritStones: combatCharacterLevel(realm, '初期') * reward.spiritStonesPerLevel,
    reputation: reward.reputation,
  };
}
