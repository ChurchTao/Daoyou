/** Public cultivation capabilities. Keep implementation files private. */
export type {
  CultivationExpCalculation,
  CultivationExpCalculationInput,
  CultivationExpCalculationTrace,
  CultivationExpRounding,
  DailyBudgetExpCalculationInput,
} from '../cultivation/exp-gain.js';
export {
  createDefaultCultivationProgress,
  getOrInitCultivationProgress,
  stripExpCapForStorage,
  syncBottleneckState,
} from '../cultivation/cultivationUtils.js';
export type { CultivationExpResult } from '../cultivation/cultivationUtils.js';
export {
  attemptBreakthrough,
  performCultivation,
} from '../cultivation/CultivationEngine.js';
export { calculateDungeonExp } from '../cultivation/exp-gain-strategies/index.js';
export type {
  BattleVictoryExpContext,
  BattleVictoryType,
  CultivationExpGainContextMap,
  CultivationExpGainScene,
  CultivationExpGainStrategy,
  DailyTaskDifficulty,
  DailyTaskExpContext,
  DungeonExpContext,
  DungeonResult,
  DungeonTier,
  EventExpContext,
  EventWeight,
  OfflineYieldExpContext,
  PillExpContext,
  RetreatExpContext,
  SystemRewardExpContext,
} from '../cultivation/exp-gain-strategies/index.js';
export {
  calculateBreakthroughChance,
  getNextStage,
} from '../cultivation/breakthroughCalculator.js';
export type { BreakthroughChanceResult } from '../cultivation/breakthroughCalculator.js';
