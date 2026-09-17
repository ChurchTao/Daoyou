import { z } from 'zod';
import { BEAST_PROGRESSION } from '../beasts/content';
import { generateCapturedBeast } from '../beasts/generator';
import { BeastSchema, type SummonedBeast } from '../beasts/schema';
import { SeededRng } from '../core';
import { WILD_PACK } from './pack';

export const WildCombatantSchema = z.strictObject({
  unitId: z.string().min(1),
  speciesId: z.string().min(1),
  level: z.number().int().min(0).max(180),
});
export type WildCombatant = z.infer<typeof WildCombatantSchema>;
export const WildIndividualSchema = WildCombatantSchema.extend({
  beast: BeastSchema,
}).refine(
  (c) => c.speciesId === c.beast.speciesId && c.level === c.beast.level,
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
  const count =
    pack.encounter.minCount +
    Math.floor(
      rng.next() * (pack.encounter.maxCount - pack.encounter.minCount + 1),
    );
  return Array.from({ length: count }, (_, slot) => ({
    unitId: `combat.wild.enemy.${slot}`,
    speciesId:
      region.speciesIds[Math.floor(rng.next() * region.speciesIds.length)]!,
    level:
      rng.next() < pack.encounter.cubChance
        ? 0
        : region.minLevel +
          Math.floor(rng.next() * (region.maxLevel - region.minLevel + 1)),
  }));
}

/** 平均分配后在每对属性间转移点数，各项不超出平均值的配置幅度。 */
export function wildAllocation(
  level: number,
  seed: number,
  spread = WILD_PACK.encounter.allocationSpread,
): SummonedBeast['allocatedAttributes'] {
  const total = level * BEAST_PROGRESSION.pointsPerLevel;
  const average = total / 5;
  const points = Array.from(
    { length: 5 },
    (_, i) => Math.floor(average) + (i < total % 5 ? 1 : 0),
  );
  const lower = Math.floor(average * (1 - spread));
  const upper = Math.ceil(average * (1 + spread));
  const rng = new SeededRng(seed);
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      const min = -Math.min(points[i] - lower, upper - points[j]);
      const max = Math.min(upper - points[i], points[j] - lower);
      const shift = min + Math.floor(rng.next() * (max - min + 1));
      points[i] += shift;
      points[j] -= shift;
    }
  }
  return {
    constitution: points[0],
    strength: points[1],
    magic: points[2],
    endurance: points[3],
    agility: points[4],
  };
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
  );
  return WildIndividualSchema.parse({
    ...combatant,
    beast: {
      ...beast,
      allocatedAttributes: wildAllocation(beast.level, seed ^ 0x45d9f3b),
      unallocatedPoints: 0,
    },
  });
}
