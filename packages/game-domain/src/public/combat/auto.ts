/** Public combat/auto capabilities. Keep implementation files private. */
export {
  AUTO_STRATEGY_SLOT_LABELS,
  AutoStrategyBookSchema,
  AutoStrategySchema,
  AutoStrategySlotIndexSchema,
  MAX_AUTO_STRATEGY_RULES,
  MAX_AUTO_STRATEGY_SLOTS,
  SaveAutoStrategySchema,
  activateStoredAutoStrategySlot,
  activeStoredAutoStrategy,
  isVacantAutoStrategyBook,
  parseStoredAutoStrategyBook,
  preferDefaultAutoStrategy,
  removeAutoStrategySlot,
  saveAutoStrategySlot,
} from '../../combat/auto-strategy.js';
export type {
  AutoComparison,
  AutoStrategy,
  AutoStrategyBook,
  AutoStrategySlotIndex,
} from '../../combat/auto-strategy.js';
export { AUTO_POLICY_VERSION } from '../../combat/auto-policy.js';
