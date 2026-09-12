export {
  BEAST_SKILLS,
  BEAST_SPECIES,
  BEAST_STARTER_SPECIES,
  BEAST_STATUS_DEFS,
} from './content';
export { generateStarterBeast } from './generator';
export { beastDeathIds, loseBeastLifespan } from './progression';
export {
  activeBeastSkills,
  beastPanel,
  beastRealm,
  canDeployBeast,
  projectBeastRoster,
} from './projection';
export {
  BEAST_VERSION,
  BeastLineupSchema,
  BeastSchema,
  type BeastLineup,
  type BeastRoster,
  type SummonedBeast,
} from './schema';

export type { BeastSpeciesDefinition } from './pack';
export { rollBeastTraits, type BeastTraits } from './trait-generator';
