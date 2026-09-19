import type { TowerReward } from '../contracts/combatV6Tower';
import { combatCharacterLevel } from '../engine/combat-v6/projection/character-level';
import { TOWER_ENCOUNTER_PACK } from '../lib/tower/encounter-pack';
import type { RealmType } from '../types/constants';
import { TOWER_REWARD_PACK } from './tower-pack';

export interface TowerRewardPlan extends Omit<TowerReward, 'items'> {
  materialCount: number;
  materialRealm: RealmType;
  materialSeed: string;
}

export function planTowerReward(
  floor: number,
  seed: number,
  realm: RealmType,
  pack = TOWER_REWARD_PACK,
): TowerRewardPlan | null {
  const tier = TOWER_ENCOUNTER_PACK.floors.find(
    (row) => row.floor === floor,
  )?.milestone;
  if (!tier) return null;
  const reward = pack.milestones[tier];
  return {
    floor,
    materialCount: reward.quantity,
    materialRealm: realm,
    materialSeed: `${seed}:tower.milestone.${floor}:material`,
    spiritStones:
      combatCharacterLevel(realm, '初期') * reward.spiritStonesPerLevel,
    reputation: reward.reputation,
  };
}
