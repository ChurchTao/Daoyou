/** Public wild capabilities. Keep implementation files private. */
export { WildRegionSchema } from '../wild/region.js';
export type { WildRegion } from '../wild/region.js';
export { createWildIndividualSchema } from '../wild/individual.js';
export type { WildCombatant, WildIndividual } from '../wild/individual.js';
export type { WildRuntimeSnapshot } from '../wild/runtime.js';
export type { WildResources } from '../wild/resources.js';
export {
  createWildEncounterSchema,
  wildEncounterView,
} from '../wild/encounter.js';
export type { WildEncounter, WildEncounterView } from '../wild/encounter.js';
export { createWildStateSchemas } from '../wild/state-schema.js';
export type { WildSettlement } from '../wild/settlement.js';
