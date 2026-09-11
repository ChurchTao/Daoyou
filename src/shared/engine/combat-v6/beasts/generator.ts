import { SeededRng } from '../core';
import { BEAST_GENERATION, BEAST_PROGRESSION, BEAST_SPECIES } from './content';
import { BEAST_VERSION, BeastSchema, type SummonedBeast } from './schema';

export function generateStarterBeast(
  id: string,
  ownerCultivatorId: string,
  speciesId: string,
  seed: number,
): SummonedBeast {
  const species = BEAST_SPECIES.find((s) => s.id === speciesId);
  if (!species) throw new Error('未知召唤兽物种');
  const rng = new SeededRng(seed);
  const aptitudes = { attack: 0, defense: 0, health: 0, mana: 0, speed: 0 };
  for (const key of Object.keys(aptitudes) as (keyof typeof aptitudes)[]) {
    const range = species.aptitudes[key];
    aptitudes[key] = range.min + Math.floor(rng.next() * (range.max - range.min + 1));
  }
  const allocatedAttributes = {
    constitution: 0,
    strength: 0,
    magic: 0,
    endurance: 0,
    agility: 0,
  };
  allocatedAttributes[species.allocation] =
    BEAST_GENERATION.starterLevel * BEAST_PROGRESSION.pointsPerLevel;
  return BeastSchema.parse({
    id,
    ownerCultivatorId,
    speciesId,
    name: species.name,
    level: BEAST_GENERATION.starterLevel,
    exp: 0,
    growth:
      (species.growthMilli.min +
        Math.floor(
          rng.next() *
            (species.growthMilli.max -
              species.growthMilli.min +
              1),
        )) /
      1000,
    aptitudes,
    allocatedAttributes,
    unallocatedPoints: 0,
    skillSlotCapacity: 1,
    skills: [species.skill],
    currentLifespan: BEAST_GENERATION.lifespan,
    maxLifespan: BEAST_GENERATION.lifespan,
    generationVersion: BEAST_VERSION,
    generationSeed: seed,
    revision: 0,
  });
}

export function generateCapturedBeast(
  id: string,
  ownerId: string,
  speciesId: string,
  level: number,
  seed: number,
): SummonedBeast {
  const base = generateStarterBeast(id, ownerId, speciesId, seed);
  const species = BEAST_SPECIES.find((s) => s.id === speciesId)!;
  const skills: string[] = [species.skill];
  if (
    new SeededRng(seed ^ 0x5bd1e995).chance(
      BEAST_GENERATION.captureBonus.chance,
    )
  )
    skills.push(BEAST_GENERATION.captureBonus.skillId);
  return BeastSchema.parse({
    ...base,
    level,
    allocatedAttributes: {
      ...base.allocatedAttributes,
      [species.allocation]: level * BEAST_PROGRESSION.pointsPerLevel,
    },
    skills,
    skillSlotCapacity: skills.length,
    generationVersion: 'summoned_beast_capture_v1',
  });
}
