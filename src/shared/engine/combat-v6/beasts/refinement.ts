import { BEAST_SPECIES, BEAST_SPECIES_REVISION } from './content';
import { BEAST_REFINEMENT } from './refinement-config';
import { BEAST_VERSION, BeastSchema, type SummonedBeast } from './schema';
import { rollBeastTraits } from './trait-generator';

export function beastRefinementReason(
  beast: SummonedBeast,
  itemId: string,
  ownerLevel: number,
): string {
  const item = BEAST_REFINEMENT.items.find((item) => item.id === itemId);
  if (!item) return '此物品不是归元灵露。';
  const species = BEAST_SPECIES.find(
    (species) => species.id === beast.speciesId,
  );
  if (!species) return '灵兽物种已不可用。';
  if (ownerLevel < species.carryLevel) return '尚未达到该物种的携带境界。';
  if (!item.allowedRealms.includes(species.realm))
    return '此物种需使用上品归元灵露。';
  return '';
}

export function refineBeast(
  beast: SummonedBeast,
  itemId: string,
  ownerLevel: number,
  seed: number,
): SummonedBeast {
  const reason = beastRefinementReason(beast, itemId, ownerLevel);
  if (reason) throw new Error(reason);
  const species = BEAST_SPECIES.find(
    (species) => species.id === beast.speciesId,
  )!;
  const traits = rollBeastTraits(species, seed);
  return BeastSchema.parse({
    ...beast,
    ...traits,
    level: BEAST_REFINEMENT.resetLevel,
    exp: BEAST_REFINEMENT.resetExperience,
    allocatedAttributes: {
      constitution: 0,
      strength: 0,
      magic: 0,
      endurance: 0,
      agility: 0,
    },
    unallocatedPoints: 0,
    skillSlotCapacity: traits.skills.length,
    currentLifespan: BEAST_REFINEMENT.restoreLifespan
      ? beast.maxLifespan
      : beast.currentLifespan,
    generationVersion: BEAST_VERSION,
    generationContentRevision: BEAST_SPECIES_REVISION,
    generationSeed: seed,
    revision: beast.revision + 1,
  });
}
