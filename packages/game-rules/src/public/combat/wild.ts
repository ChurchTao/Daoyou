/** Public combat/wild capabilities. Keep implementation files private. */
export {
  WILD_EXPLORATION_COOLDOWN_MS,
  settleWildResources,
} from '../../combat/wild/rules.js';
export { WildHost, createWildHost } from '../../combat/wild/host.js';
export type { WildCombatant } from '../../combat/wild/host.js';
export {
  WildEncounterSchema,
  WildRuntimeSchema,
  WildSettlementSchema,
} from '../../combat/wild/state-schema.js';
