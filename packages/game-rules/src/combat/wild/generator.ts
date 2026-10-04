import { createWildIndividualSchema, type WildCombatant, type WildIndividual } from '@daoyou/game-domain/wild';
export const WildIndividualSchema = createWildIndividualSchema(BeastSchema);

import { distributeBeastPoints } from '../../beasts/allocation.js';

import { BEAST_PROGRESSION } from '@daoyou/game-content/beasts';

import { generateCapturedBeast } from '../../beasts/generator.js';

import { BeastSchema, GeneratedBeastSchema } from '../../beasts/schema.js';

import { SeededRng } from '@daoyou/combat-core/rng';

import { WILD_PACK } from '@daoyou/game-content/combat/wild';

export function generateWildEncounter(
  nodeId: string,
  seed: number,
  pack = WILD_PACK,
): WildCombatant[] {
  const region = pack.regions.find((r) => r.nodeId === nodeId);
  if (!region) throw new Error('UNKNOWN_WILD_REGION');
  const rng = new SeededRng(seed);
  const mutationRng = new SeededRng(seed ^ 0x6a09e667);
  const count =
    pack.encounter.minCount +
    Math.floor(
      rng.next() * (pack.encounter.maxCount - pack.encounter.minCount + 1),
    );
  return Array.from({ length: count }, (_, slot) => {
    const species =
      region.species[Math.floor(rng.next() * region.species.length)]!;
    const isMutant = mutationRng.next() < pack.encounter.mutantChance;
    const ordinaryLevel =
      rng.next() < pack.encounter.cubChance
        ? 0
        : species.minLevel +
          Math.floor(rng.next() * (species.maxLevel - species.minLevel + 1));
    return {
      unitId: `combat.wild.enemy.${slot}`,
      speciesId: species.speciesId,
      level: isMutant ? 0 : ordinaryLevel,
      ...(isMutant ? { isMutant: true } : {}),
    };
  });
}


export function wildAllocation(
  level: number,
  seed: number,
  spread = WILD_PACK.encounter.allocationSpread,
) {
  return distributeBeastPoints(
    level * (BEAST_PROGRESSION.pointsPerLevel - 2),
    seed,
    spread,
  );
}

export function generateWildIndividual(
  combatant: WildCombatant,
  id: string,
  ownerId: string,
  seed: number,
): WildIndividual {
  const beast = generateCapturedBeast(
    id,
    ownerId,
    combatant.speciesId,
    combatant.level,
    seed,
    combatant.isMutant,
  );
  return WildIndividualSchema.parse({
    ...combatant,
    beast: GeneratedBeastSchema.parse({
      ...beast,
      ...(beast.originKind === 'wild'
        ? {
            allocatedAttributes: wildAllocation(
              beast.level,
              seed ^ 0x45d9f3b,
            ),
            unallocatedPoints: 0,
          }
        : {}),
    }),
  });
}
