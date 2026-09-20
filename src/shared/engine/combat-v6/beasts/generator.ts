import {
  BEAST_GENERATION,
  BEAST_SPECIES,
  BEAST_SPECIES_REVISION,
} from './content';
import { beastPointBudget, type BeastOriginKind } from './identity';
import {
  BEAST_VERSION,
  GeneratedBeastSchema,
  type SummonedBeast,
} from './schema';
import { rollBeastTraits } from './trait-generator';

function createIndividual(
  id: string,
  ownerCultivatorId: string,
  speciesId: string,
  level: number,
  seed: number,
  isMutant = false,
  originKind: BeastOriginKind = 'baby',
): SummonedBeast {
  const species = BEAST_SPECIES.find((s) => s.id === speciesId);
  if (!species) throw new Error('未知召唤兽物种');
  const traits = rollBeastTraits(species, seed, isMutant);
  return GeneratedBeastSchema.parse({
    id,
    ownerCultivatorId,
    speciesId,
    ...(isMutant ? { isMutant: true } : {}),
    originKind,
    initialLevel: level,
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
    unallocatedPoints: beastPointBudget({
      level,
      initialLevel: level,
      originKind,
    }),
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
  isMutant = false,
): SummonedBeast {
  return createIndividual(
    id,
    ownerId,
    speciesId,
    level,
    seed,
    isMutant,
    isMutant || level === 0 ? 'baby' : 'wild',
  );
}
