import {
  BATTLE_VICTORY_EXP_BUDGET,
  DAILY_TASK_EXP_BUDGET,
  DUNGEON_EXP_BUDGET,
  EVENT_EXP_BUDGET,
  EXP_GAIN_REALM_PACE_MULTIPLIER,
  OFFLINE_YIELD_EXP_BUDGET,
  PILL_EXP_BUDGET,
  RETREAT_EXP_BUDGET,
  SYSTEM_REWARD_EXP_BUDGET,
} from '@shared/config/cultivationExpGain';
import {
  calculateCultivationExpByCap,
  type CultivationExpCalculation,
} from '@shared/lib/cultivationExpGain';
import { QUALITY_ORDER } from '@shared/types/constants';
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
  resolveExpCap,
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
  return tier === 'S' || tier === 'A' || tier === 'B' || tier === 'C' || tier === 'D'
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

function resolveRealmPaceMultiplier(realm: RealmType): number {
  return EXP_GAIN_REALM_PACE_MULTIPLIER[realm] ?? 1;
}

export const retreatStrategy: CultivationExpGainStrategy<RetreatExpContext> = {
  id: 'retreat',
  resolve(context) {
    const years = clampNonNegativeFinite(context.years ?? 1);
    const units = Math.min(years, RETREAT_EXP_BUDGET.maxYears);
    return {
      cap: resolveExpCap(context),
      percent:
        RETREAT_EXP_BUDGET.percentByRealm[context.realm] ??
        RETREAT_EXP_BUDGET.percentByRealm['炼气'],
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
      cap: resolveExpCap(context),
      percent:
        OFFLINE_YIELD_EXP_BUDGET.percentPerUnit *
        clampNonNegativeFinite(context.randomFactor ?? 1, 1) *
        resolveRealmPaceMultiplier(context.realm),
      units,
      minBaseExp: OFFLINE_YIELD_EXP_BUDGET.minBaseExp,
    };
  },
};

export const battleVictoryStrategy: CultivationExpGainStrategy<BattleVictoryExpContext> = {
  id: 'battle_victory',
  resolve(context) {
    const victoryType = context.victoryType ?? 'normal';
    return {
      cap: resolveExpCap(context),
      percent:
        BATTLE_VICTORY_EXP_BUDGET.percent *
        resolveRealmDiffMultiplier(context.realmDiff ?? 0) *
        BATTLE_VICTORY_EXP_BUDGET.victoryMultiplier[victoryType] *
        resolveRealmPaceMultiplier(context.realm),
      minBaseExp: BATTLE_VICTORY_EXP_BUDGET.minBaseExp,
    };
  },
};

export const dungeonStrategy: CultivationExpGainStrategy<DungeonExpContext> = {
  id: 'dungeon',
  resolve(context) {
    const basePercent = context.result
      ? DUNGEON_EXP_BUDGET.resultPercent[context.result]
      : DUNGEON_EXP_BUDGET.tierPercent[normalizeDungeonTier(context.tier)];
    const dangerBonus = Math.min(
      clampNonNegativeFinite(context.dangerBonus ?? 0),
      1,
    );

    return {
      cap: resolveExpCap(context),
      percent:
        basePercent *
        (1 + dangerBonus * DUNGEON_EXP_BUDGET.dangerBonusScale) *
        resolveRealmPaceMultiplier(context.realm),
      minBaseExp: DUNGEON_EXP_BUDGET.minBaseExp,
    };
  },
};

export const dailyTaskStrategy: CultivationExpGainStrategy<DailyTaskExpContext> = {
  id: 'daily_task',
  resolve(context) {
    return {
      cap: resolveExpCap(context),
      percent:
        DAILY_TASK_EXP_BUDGET.difficultyPercent[context.difficulty ?? 'normal'] *
        resolveRealmPaceMultiplier(context.realm),
      minBaseExp: DAILY_TASK_EXP_BUDGET.minBaseExp,
    };
  },
};

export const pillStrategy: CultivationExpGainStrategy<PillExpContext> = {
  id: 'pill',
  resolve(context) {
    const quality = context.quality ?? '凡品';
    const qualityScalar =
      context.qualityScalar ??
      1 + (QUALITY_ORDER[quality] ?? QUALITY_ORDER['凡品']) * 0.22;
    const qualityPercent =
      context.qualityScalar !== undefined
        ? PILL_EXP_BUDGET.percentByQuality['凡品'] *
          clampNonNegativeFinite(qualityScalar, 1)
        : PILL_EXP_BUDGET.percentByQuality[quality] ??
          PILL_EXP_BUDGET.percentByQuality['凡品'];
    const fitMultiplier = clampNonNegativeFinite(context.fitMultiplier ?? 1, 1);

    return {
      cap: resolveExpCap(context),
      percent:
        qualityPercent *
        fitMultiplier *
        resolveRealmPaceMultiplier(context.realm),
      minBaseExp: PILL_EXP_BUDGET.minBaseExp,
    };
  },
};

export const eventStrategy: CultivationExpGainStrategy<EventExpContext> = {
  id: 'event',
  resolve(context) {
    return {
      cap: resolveExpCap(context),
      percent:
        EVENT_EXP_BUDGET.percentByWeight[context.weight ?? 'normal'] *
        clampNonNegativeFinite(context.multiplier ?? 1, 1) *
        resolveRealmPaceMultiplier(context.realm),
      minBaseExp: EVENT_EXP_BUDGET.minBaseExp,
    };
  },
};

export const systemRewardStrategy: CultivationExpGainStrategy<SystemRewardExpContext> = {
  id: 'system_reward',
  resolve(context) {
    const percent =
      SYSTEM_REWARD_EXP_BUDGET.percentByWeight[context.weight ?? 'normal'] *
      clampNonNegativeFinite(context.multiplier ?? 1, 1) *
      resolveRealmPaceMultiplier(context.realm);
    return {
      cap: resolveExpCap(context),
      percent,
      minBaseExp: SYSTEM_REWARD_EXP_BUDGET.minBaseExp,
      maxBaseExp: Math.floor(resolveExpCap(context) * SYSTEM_REWARD_EXP_BUDGET.maxPercent),
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
  return calculateCultivationExpByCap(strategy.resolve(context));
}

export function getBaseExp(
  scene: CultivationExpGainScene,
  realm: RealmType,
  realmStage: RealmStage,
): number {
  return calculateSceneCultivationExp(scene, { realm, realmStage } as never).baseExp;
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
