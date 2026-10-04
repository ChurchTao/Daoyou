import type { PresentedBattleInput } from './battle-input.js';
import type { AutoStrategy } from './auto-strategy.js';


export type RankingBattleInput = PresentedBattleInput & {
  seed: number;
  autoStrategies?: Record<string, AutoStrategy>;
};
