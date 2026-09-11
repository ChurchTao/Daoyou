import { rollDrops, type DropPool } from '../drops';
import { SeededRng } from '../engine/combat-v6/core';
import type { ItemGrant } from '../inventory';
import { DUNGEON_REWARD_PACK } from './dungeon-pack';

export type DungeonRewardSource = 'exploration' | 'battle' | 'completion';
export interface DungeonRewardEntry {
  key: string;
  items: ItemGrant[];
  experience: number;
  spiritStones: number;
  beastExperience?: { beastId: string; amount: number };
}
export const DUNGEON_REWARD_CONFIG = DUNGEON_REWARD_PACK.sources;

/** Caller supplies a persisted seed for this run; neither AI score nor client input affects rewards. */
export function dungeonReward(
  seed: number,
  key: string,
  source: DungeonRewardSource,
  level: number,
  pack = DUNGEON_REWARD_PACK,
): DungeonRewardEntry {
  if (!Number.isInteger(level) || level < 1 || level > 180)
    throw new Error('Invalid dungeon reward level');
  const config = pack.sources[source];
  const pool: DropPool = {
    id: `dungeon.${source}`,
    version: 1,
    groups: [
      {
        id: 'materials',
        chance: config.chance,
        entries: pack.materials.map((item) => ({
          rewardId: item.rewardId,
          weight: item.weight,
          quantity: { min: config.quantity, max: config.quantity },
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
