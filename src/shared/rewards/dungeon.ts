import { rollDrops, type DropPool } from '../drops';
import { SeededRng } from '../engine/combat-v6/core';
import type { ItemGrant } from '../inventory';
import { FIXED_MATERIALS } from '../items/definitions/fixed-materials';

export type DungeonRewardSource = 'exploration' | 'battle' | 'completion';
export interface DungeonRewardEntry {
  key: string;
  items: ItemGrant[];
  experience: number;
  spiritStones: number;
  beastExperience?: { beastId: string; amount: number };
}
export const DUNGEON_REWARD_CONFIG = {
  exploration: { chance: 0.3, experience: 2, stones: 1 },
  battle: { chance: 0.6, experience: 5, stones: 2 },
  completion: { chance: 1, experience: 10, stones: 5 },
} as const;

/** Caller supplies a persisted seed for this run; neither AI score nor client input affects rewards. */
export function dungeonReward(
  seed: number,
  key: string,
  source: DungeonRewardSource,
  level: number,
): DungeonRewardEntry {
  if (!Number.isInteger(level) || level < 1 || level > 180)
    throw new Error('Invalid dungeon reward level');
  const config = DUNGEON_REWARD_CONFIG[source];
  const pool: DropPool = {
    id: `dungeon.${source}`,
    version: 1,
    groups: [
      {
        id: 'materials',
        chance: config.chance,
        entries: FIXED_MATERIALS.map((item) => ({
          rewardId: item.id,
          weight: 1,
          quantity: { min: 1, max: 1 },
        })),
      },
    ],
  };
  // Stable per-source stream. The generator is independent of battle RNG.
  let stream = seed >>> 0;
  for (const character of key)
    stream = Math.imul(stream ^ character.charCodeAt(0), 16777619) >>> 0;
  const rng = new SeededRng(stream);
  return {
    key,
    items: rollDrops(pool, () => () => rng.next()).rewards.map((r) => ({
      definitionId: r.rewardId,
      quantity: r.quantity,
    })),
    experience: level * config.experience,
    spiritStones: level * config.stones,
  };
}
export function appendDungeonReward(
  entries: DungeonRewardEntry[],
  entry: DungeonRewardEntry,
) {
  return entries.some((existing) => existing.key === entry.key)
    ? entries
    : [...entries, entry];
}
