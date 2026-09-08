import type { TowerReward } from '../contracts/combatV6Tower';
import { rollDrops, type DropPool } from '../drops';
import { SeededRng } from '../engine/combat-v6/core';
import { combatCharacterLevel } from '../engine/combat-v6/projection/character-level';
import { FIXED_MATERIALS } from '../items/definitions/fixed-materials';
import type { RealmType } from '../types/constants';

export function towerReward(
  floor: number,
  seed: number,
  realm: RealmType,
): TowerReward | null {
  if (![5, 10, 15, 20].includes(floor)) return null;
  const tier = floor / 5;
  const pool: DropPool = {
    id: `tower.milestone.${floor}`,
    version: 1,
    groups: [
      {
        id: 'materials',
        chance: 1,
        entries: FIXED_MATERIALS.map((item) => ({
          rewardId: item.id,
          weight: 1,
          quantity: { min: tier, max: tier },
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
    spiritStones: combatCharacterLevel(realm, '初期') * tier * 5,
    reputation: floor,
  };
}
