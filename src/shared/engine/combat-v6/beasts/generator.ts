import {
  BEAST_GENERATION,
  BEAST_PROGRESSION,
  BEAST_SPECIES,
  BEAST_SPECIES_REVISION,
} from './content';
import { BEAST_VERSION, BeastSchema, type SummonedBeast } from './schema';
import { rollBeastTraits } from './trait-generator';

function createIndividual(
  id: string,
  ownerCultivatorId: string,
  speciesId: string,
  level: number,
  seed: number,
): SummonedBeast {
  const species = BEAST_SPECIES.find((s) => s.id === speciesId);
  if (!species) throw new Error('未知召唤兽物种');
  const traits = rollBeastTraits(species, seed);
  return BeastSchema.parse({
    id,
    ownerCultivatorId,
    speciesId,
    name: species.name,
    level,
    exp: 0,
    ...traits,
    allocatedAttributes: {
      constitution: 0,
      strength: 0,
      magic: 0,
      endurance: 0,
      agility: 0,
    },
    unallocatedPoints: level * BEAST_PROGRESSION.pointsPerLevel,
    skillSlotCapacity: traits.skills.length,
    currentLifespan: BEAST_GENERATION.lifespan,
    maxLifespan: BEAST_GENERATION.lifespan,
    generationVersion: BEAST_VERSION,
    generationContentRevision: BEAST_SPECIES_REVISION,
    generationSeed: seed,
    revision: 0,
  });
}

export function generateStarterBeast(
  id: string,
  ownerCultivatorId: string,
  speciesId: string,
  seed: number,
): SummonedBeast {
  return createIndividual(
    id,
    ownerCultivatorId,
    speciesId,
    BEAST_GENERATION.starterLevel,
    seed,
  );
}

export function generateCapturedBeast(
  id: string,
  ownerId: string,
  speciesId: string,
  level: number,
  seed: number,
): SummonedBeast {
  return createIndividual(id, ownerId, speciesId, level, seed);
}
