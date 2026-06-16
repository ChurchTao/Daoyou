import { EXP_CAP_TABLE } from '@shared/config/cultivationProgress';
import type {
  CultivationExpCalculation,
  CultivationExpCalculationInput,
  DailyBudgetExpCalculationInput,
} from '@shared/lib/cultivationExpGain';
import type { Quality, RealmStage, RealmType } from '@shared/types/constants';

export const EXP_GAIN_SCENES = [
  'retreat',
  'offline_yield',
  'battle_victory',
  'dungeon',
  'daily_task',
  'pill',
  'event',
  'system_reward',
] as const;

export type CultivationExpGainScene = (typeof EXP_GAIN_SCENES)[number];

export interface CultivationExpGainStrategy<Context> {
  id: CultivationExpGainScene;
  resolve(
    context: Context,
  ): CultivationExpCalculationInput | DailyBudgetExpCalculationInput;
  describe?(result: CultivationExpCalculation): string;
}

export interface RealmStageExpContext {
  realm: RealmType;
  realmStage: RealmStage;
  expCap?: number;
}

export interface RetreatExpContext extends RealmStageExpContext {
  years?: number;
}

export interface OfflineYieldExpContext extends RealmStageExpContext {
  hoursElapsed: number;
  randomFactor?: number;
}

export type BattleVictoryType = 'normal' | 'perfect' | 'challenged';

export interface BattleVictoryExpContext extends RealmStageExpContext {
  realmDiff?: number;
  victoryType?: BattleVictoryType;
}

export type DungeonTier = 'S' | 'A' | 'B' | 'C' | 'D';
export type DungeonResult = 'perfect' | 'good' | 'normal' | 'failed';

export interface DungeonExpContext extends RealmStageExpContext {
  tier?: string;
  result?: DungeonResult;
  dangerBonus?: number;
}

export type DailyTaskDifficulty = 'easy' | 'normal' | 'hard' | 'elite';

export interface DailyTaskExpContext extends RealmStageExpContext {
  difficulty?: DailyTaskDifficulty;
}

export interface PillExpContext extends RealmStageExpContext {
  quality?: Quality;
  qualityScalar?: number;
  fitMultiplier?: number;
}

export type EventWeight = 'minor' | 'normal' | 'major';

export interface EventExpContext extends RealmStageExpContext {
  weight?: EventWeight;
  multiplier?: number;
}

export interface SystemRewardExpContext extends RealmStageExpContext {
  weight?: EventWeight;
  multiplier?: number;
}

export interface CultivationExpGainContextMap {
  retreat: RetreatExpContext;
  offline_yield: OfflineYieldExpContext;
  battle_victory: BattleVictoryExpContext;
  dungeon: DungeonExpContext;
  daily_task: DailyTaskExpContext;
  pill: PillExpContext;
  event: EventExpContext;
  system_reward: SystemRewardExpContext;
}

export function resolveExpCap(context: RealmStageExpContext): number {
  if (
    typeof context.expCap === 'number' &&
    Number.isFinite(context.expCap) &&
    context.expCap > 0
  ) {
    return Math.floor(context.expCap);
  }

  return (
    EXP_CAP_TABLE[context.realm]?.[context.realmStage] ??
    EXP_CAP_TABLE['炼气']['初期']
  );
}

export function clampNonNegativeFinite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}
