import { SeededRng } from '../core';
import { WILD_PACK } from './pack';

export type WildCombatant = { unitId: string; speciesId: string; level: number };
export function generateWildEncounter(nodeId: string, seed: number, pack = WILD_PACK): WildCombatant[] {
  if (nodeId !== pack.region.nodeId) throw new Error('UNKNOWN_WILD_REGION');
  const rng = new SeededRng(seed);
  const count = pack.encounter.minCount + Math.floor(rng.next() * (pack.encounter.maxCount - pack.encounter.minCount + 1));
  return Array.from({ length: count }, (_, slot) => ({
    unitId: `combat.wild.enemy.${slot}`,
    speciesId: pack.species[Math.floor(rng.next() * pack.species.length)]!.id,
    level: pack.region.minLevel + Math.floor(rng.next() * (pack.region.maxLevel - pack.region.minLevel + 1)),
  }));
}
