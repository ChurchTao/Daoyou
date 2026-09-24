import { z } from 'zod';
import { distributeBeastPoints } from '../beasts/allocation';
import { BEAST_PROGRESSION } from '../beasts/content';
import { generateCapturedBeast } from '../beasts/generator';
import { BeastSchema, GeneratedBeastSchema } from '../beasts/schema';
import { SeededRng } from '../core';
import { WILD_PACK } from './pack';

export const WildCombatantSchema = z.strictObject({
  unitId: z.string().min(1),
  speciesId: z.string().min(1),
  level: z.number().int().min(0).max(180),
  isMutant: z.boolean().optional(),
});
export type WildCombatant = z.infer<typeof WildCombatantSchema>;
export const WildIndividualSchema = WildCombatantSchema.extend({
  beast: BeastSchema,
}).refine(
  (c) =>
    c.speciesId === c.beast.speciesId &&
    c.level === c.beast.level &&
    !!c.isMutant === !!c.beast.isMutant,
  '野外个体与遭遇信息不一致',
);
export type WildIndividual = z.infer<typeof WildIndividualSchema>;
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
