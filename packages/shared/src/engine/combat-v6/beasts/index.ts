export {
  BEAST_SKILLS,
  BEAST_SPECIES,
  BEAST_STARTER_SPECIES,
  BEAST_STATUS_DEFS,
} from './content.js';
export { generateStarterBeast } from './generator.js';
export { beastDeathIds, loseBeastLifespan } from './progression.js';
export {
  activeBeastSkills,
  beastPanel,
  canDeployBeast,
  projectBeastRoster,
} from './projection.js';
export {
  BEAST_VERSION,
  BeastLineupSchema,
  BeastSchema,
  type BeastLineup,
  type BeastRoster,
  type SummonedBeast,
} from './schema.js';

export type { BeastSpeciesDefinition } from './pack.js';
export { rollBeastTraits, type BeastTraits } from './trait-generator.js';
