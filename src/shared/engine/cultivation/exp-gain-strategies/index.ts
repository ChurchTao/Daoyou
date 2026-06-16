import {
  BATTLE_VICTORY_EXP_BUDGET,
  DAILY_TASK_EXP_BUDGET,
  DUNGEON_EXP_BUDGET,
  EVENT_EXP_BUDGET,
  OFFLINE_YIELD_EXP_BUDGET,
  REALM_DAILY_EXP_BUDGET,
  RETREAT_EXP_BUDGET,
  SYSTEM_REWARD_EXP_BUDGET,
} from '@shared/config/cultivationExpGain';
import {
  calculateCultivationExpByCap,
  calculateCultivationExpByDailyBudget,
  type CultivationExpCalculationInput,
  type DailyBudgetExpCalculationInput,
  type CultivationExpCalculation,
} from '@shared/lib/cultivationExpGain';
import { buildPillCultivationExpInput } from '@shared/lib/pillCultivationExp';
import type { RealmStage, RealmType } from '@shared/types/constants';
import {
  clampNonNegativeFinite,
  type BattleVictoryExpContext,
  type CultivationExpGainContextMap,
  type CultivationExpGainScene,
  type CultivationExpGainStrategy,
  type DailyTaskExpContext,
  type DungeonExpContext,
  type DungeonTier,
  type EventExpContext,
  type OfflineYieldExpContext,
  type PillExpContext,
  type RetreatExpContext,
  type SystemRewardExpContext,
} from './types';

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
} from './types';

function normalizeDungeonTier(tier: string | undefined): DungeonTier {
  return tier === 'S' ||
    tier === 'A' ||
    tier === 'B' ||
    tier === 'C' ||
    tier === 'D'
    ? tier
    : 'D';
}

function resolveRealmDiffMultiplier(realmDiff: number): number {
  const config = BATTLE_VICTORY_EXP_BUDGET.realmDiffMultiplier;
  if (realmDiff >= 2) return config.twoOrMoreAbove;
  if (realmDiff === 1) return config.oneAbove;
  if (realmDiff <= -1) return config.weaker;
  return config.same;
}

function resolveDailyBudget(realm: RealmType): number {
  return REALM_DAILY_EXP_BUDGET[realm] ?? REALM_DAILY_EXP_BUDGET['炼气'];
}

function calculateResolvedExp(
  input: CultivationExpCalculationInput | DailyBudgetExpCalculationInput,
): CultivationExpCalculation {
  if ('dailyBudget' in input) {
    return calculateCultivationExpByDailyBudget(input);
  }

  return calculateCultivationExpByCap(input);
}

export const retreatStrategy: CultivationExpGainStrategy<RetreatExpContext> = {
  id: 'retreat',
  resolve(context) {
    const years = clampNonNegativeFinite(context.years ?? 1);
    const units = Math.min(years, RETREAT_EXP_BUDGET.maxYears);
    return {
      dailyBudget: resolveDailyBudget(context.realm),
      sourceDailyFraction: RETREAT_EXP_BUDGET.dailyFractionPerYear,
      units,
      minBaseExp: RETREAT_EXP_BUDGET.minBaseExp,
    };
  },
};

export const offlineYieldStrategy: CultivationExpGainStrategy<OfflineYieldExpContext> = {
  id: 'offline_yield',
  resolve(context) {
    const hoursElapsed = clampNonNegativeFinite(context.hoursElapsed);
    const units = Math.min(
      hoursElapsed / OFFLINE_YIELD_EXP_BUDGET.hoursPerUnit,
      OFFLINE_YIELD_EXP_BUDGET.maxUnits,
    );
    return {
      dailyBudget: resolveDailyBudget(context.realm),
      sourceDailyFraction: OFFLINE_YIELD_EXP_BUDGET.dailyFractionPerUnit,
      units,
      sourceMultiplier: clampNonNegativeFinite(context.randomFactor ?? 1, 1),
      minBaseExp: OFFLINE_YIELD_EXP_BUDGET.minBaseExp,
    };
  },
};

export const battleVictoryStrategy: CultivationExpGainStrategy<BattleVictoryExpContext> = {
  id: 'battle_victory',
  resolve(context) {
    const victoryType = context.victoryType ?? 'normal';
    return {
      dailyBudget: resolveDailyBudget(context.realm),
      sourceDailyFraction: BATTLE_VICTORY_EXP_BUDGET.dailyFraction,
      sourceMultiplier:
        resolveRealmDiffMultiplier(context.realmDiff ?? 0) *
        BATTLE_VICTORY_EXP_BUDGET.victoryMultiplier[victoryType],
      minBaseExp: BATTLE_VICTORY_EXP_BUDGET.minBaseExp,
    };
  },
};

export const dungeonStrategy: CultivationExpGainStrategy<DungeonExpContext> = {
  id: 'dungeon',
  resolve(context) {
    const baseDailyFraction = context.result
      ? DUNGEON_EXP_BUDGET.resultDailyFraction[context.result]
      : DUNGEON_EXP_BUDGET.tierDailyFraction[normalizeDungeonTier(context.tier)];
    const dangerBonus = Math.min(
      clampNonNegativeFinite(context.dangerBonus ?? 0),
      1,
    );

    return {
      dailyBudget: resolveDailyBudget(context.realm),
      sourceDailyFraction: baseDailyFraction,
      sourceMultiplier: 1 + dangerBonus * DUNGEON_EXP_BUDGET.dangerBonusScale,
      minBaseExp: DUNGEON_EXP_BUDGET.minBaseExp,
    };
  },
};

export const dailyTaskStrategy: CultivationExpGainStrategy<DailyTaskExpContext> = {
  id: 'daily_task',
  resolve(context) {
    return {
      dailyBudget: resolveDailyBudget(context.realm),
      sourceDailyFraction:
        DAILY_TASK_EXP_BUDGET.difficultyDailyFraction[
          context.difficulty ?? 'normal'
        ],
      minBaseExp: DAILY_TASK_EXP_BUDGET.minBaseExp,
    };
  },
};

export const pillStrategy: CultivationExpGainStrategy<PillExpContext> = {
  id: 'pill',
  resolve(context) {
    return buildPillCultivationExpInput(context);
  },
};

export const eventStrategy: CultivationExpGainStrategy<EventExpContext> = {
  id: 'event',
  resolve(context) {
    return {
      dailyBudget: resolveDailyBudget(context.realm),
      sourceDailyFraction:
        EVENT_EXP_BUDGET.dailyFractionByWeight[context.weight ?? 'normal'],
      sourceMultiplier: clampNonNegativeFinite(context.multiplier ?? 1, 1),
      minBaseExp: EVENT_EXP_BUDGET.minBaseExp,
    };
  },
};

export const systemRewardStrategy: CultivationExpGainStrategy<SystemRewardExpContext> = {
  id: 'system_reward',
  resolve(context) {
    const dailyBudget = resolveDailyBudget(context.realm);
    return {
      dailyBudget,
      sourceDailyFraction:
        SYSTEM_REWARD_EXP_BUDGET.dailyFractionByWeight[
          context.weight ?? 'normal'
        ],
      sourceMultiplier: clampNonNegativeFinite(context.multiplier ?? 1, 1),
      minBaseExp: SYSTEM_REWARD_EXP_BUDGET.minBaseExp,
      maxBaseExp: Math.floor(
        dailyBudget * SYSTEM_REWARD_EXP_BUDGET.maxDailyFraction,
      ),
    };
  },
};

export const EXP_GAIN_STRATEGIES = {
  retreat: retreatStrategy,
  offline_yield: offlineYieldStrategy,
  battle_victory: battleVictoryStrategy,
  dungeon: dungeonStrategy,
  daily_task: dailyTaskStrategy,
  pill: pillStrategy,
  event: eventStrategy,
  system_reward: systemRewardStrategy,
} satisfies {
  [Scene in CultivationExpGainScene]: CultivationExpGainStrategy<
    CultivationExpGainContextMap[Scene]
  >;
};

export function calculateSceneCultivationExp<
  Scene extends CultivationExpGainScene,
>(
  scene: Scene,
  context: CultivationExpGainContextMap[Scene],
): CultivationExpCalculation {
  const strategy = EXP_GAIN_STRATEGIES[scene] as CultivationExpGainStrategy<
    CultivationExpGainContextMap[Scene]
  >;
  return calculateResolvedExp(strategy.resolve(context));
}

export function getBaseExp(
  scene: CultivationExpGainScene,
  realm: RealmType,
  realmStage: RealmStage,
): number {
  return calculateSceneCultivationExp(scene, { realm, realmStage } as never)
    .baseExp;
}

export function calculateRetreatBaseExp(
  realm: RealmType,
  realmStage: RealmStage,
  years = 1,
  expCap?: number,
): number {
  return calculateSceneCultivationExp('retreat', {
    realm,
    realmStage,
    years,
    expCap,
  }).baseExp;
}

export function calculateOfflineExp(
  realm: RealmType,
  realmStage: RealmStage,
  hoursElapsed: number,
  rng: () => number = Math.random,
  expCap?: number,
): number {
  const randomFactor =
    OFFLINE_YIELD_EXP_BUDGET.randomFactor.min +
    rng() * OFFLINE_YIELD_EXP_BUDGET.randomFactor.range;
  return calculateSceneCultivationExp('offline_yield', {
    realm,
    realmStage,
    hoursElapsed,
    randomFactor,
    expCap,
  }).baseExp;
}

export function calculateDungeonExp(
  realm: RealmType,
  realmStage: RealmStage,
  tier: string,
  dangerBonus = 0,
  expCap?: number,
): number {
  return calculateSceneCultivationExp('dungeon', {
    realm,
    realmStage,
    tier,
    dangerBonus,
    expCap,
  }).baseExp;
}

export function calculatePillExp(
  realm: RealmType,
  qualityScalar: number,
  realmStage: RealmStage = '初期',
  expCap?: number,
): number {
  return calculateSceneCultivationExp('pill', {
    realm,
    realmStage,
    qualityScalar,
    expCap,
  }).baseExp;
}

export function calculateBattleExp(
  realm: RealmType,
  realmStage: RealmStage,
  realmDiff: number,
  victoryType: 'normal' | 'perfect' | 'challenged' = 'normal',
  expCap?: number,
): number {
  return calculateSceneCultivationExp('battle_victory', {
    realm,
    realmStage,
    realmDiff,
    victoryType,
    expCap,
  }).baseExp;
}

export function calculateEventExp(
  realm: RealmType,
  realmStage: RealmStage,
  multiplier = 1,
  expCap?: number,
): number {
  return calculateSceneCultivationExp('event', {
    realm,
    realmStage,
    multiplier,
    expCap,
  }).baseExp;
}
