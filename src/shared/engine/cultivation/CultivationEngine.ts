import {
  REALM_STAGE_CAPS,
  type RealmStage,
  type RealmType,
} from '@shared/types/constants';
import {
  evaluateFateContext,
} from '@shared/lib/fates';
import { isConditionStatusActive } from '@shared/lib/condition';
import {
  consumeCultivationBoostStatus,
  getCultivationBoostRetreatMultiplier,
} from '@shared/lib/cultivationBoost';
import {
  getProtectMeridiansReductionPercent,
} from '@shared/lib/pillEffectScaling';
import type {
  ConditionStatusInstance,
  ConditionStatusKey,
} from '@shared/types/condition';
import type {
  Attributes,
  BreakthroughHistoryEntry,
  Cultivator,
  RetreatRecord,
} from '@shared/types/cultivator';
import {
  applyAttributeGrowth,
  calculateBreakthroughChance,
  getAttributeGrowthRange,
  getNextStage,
  LIFESPAN_BONUS_BY_REALM,
  type BreakthroughModifiers,
} from '@server/utils/breakthroughCalculator';
import {
  calculateCultivationExp,
  calculateExpLossOnFailure,
  calculateExpProgress,
  canAttemptBreakthrough,
  getBreakthroughType,
  getCultivationProgress,
  isBottleneckReached,
  resolveLiveExpCap,
} from '@server/utils/cultivationUtils';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomInt(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function getMajorDeviationGain(
  fromRealm: RealmType,
  rng: () => number,
): number {
  switch (fromRealm) {
    case '金丹':
      return randomInt(22, 35, rng);
    case '元婴':
      return randomInt(30, 45, rng);
    case '化神':
      return randomInt(35, 50, rng);
    case '炼虚':
      return randomInt(40, 55, rng);
    case '合体':
      return randomInt(45, 60, rng);
    case '大乘':
      return randomInt(50, 65, rng);
    default:
      return randomInt(12, 20, rng);
  }
}

function getActiveStatus(
  cultivator: Cultivator,
  statusKey: ConditionStatusKey,
): ConditionStatusInstance | null {
  return (
    cultivator.condition?.statuses.find(
      (status) => status.key === statusKey && isConditionStatusActive(status),
    ) ?? null
  );
}

function getInnerDemonTriggerChance(
  consecutiveFailures: number,
  isMajorBreakthrough: boolean,
): number {
  return clamp(
    0.15 +
      Math.max(0, consecutiveFailures - 1) * 0.2 +
      (isMajorBreakthrough ? 0.15 : 0),
    0,
    0.9,
  );
}

/**
 * 闭关修炼结果
 */
export interface CultivationResult {
  cultivator: Cultivator;
  summary: {
    exp_gained: number;
    exp_before: number;
    exp_after: number;
    insight_gained: number;
    epiphany_triggered: boolean;
    bottleneck_entered: boolean;
    can_breakthrough: boolean;
    progress: number; // 百分比
  };
  record: RetreatRecord;
}

/**
 * 突破尝试结果
 */
export interface BreakthroughResult {
  cultivator: Cultivator;
  summary: {
    success: boolean;
    chance: number;
    roll: number;
    fromRealm: RealmType;
    fromStage: RealmStage;
    toRealm?: RealmType;
    toStage?: RealmStage;
    lifespanGained: number;
    attributeGrowth: Partial<Attributes>;
    exp_progress: number;
    insight_value: number;
    exp_lost?: number;
    breakthrough_type: 'forced' | 'normal' | 'perfect';
    insight_change: number;
    inner_demon_triggered: boolean;
    modifiers: BreakthroughModifiers;
  };
  historyEntry?: BreakthroughHistoryEntry;
}

/**
 * 执行闭关修炼（不含突破）
 */
export function performCultivation(
  rawCultivator: Cultivator,
  years: number,
  rng: () => number = Math.random,
): CultivationResult {
  if (years <= 0) {
    throw new Error('闭关年限必须大于0');
  }

  const cultivator = JSON.parse(JSON.stringify(rawCultivator)) as Cultivator;

  // 确保有修为进度数据
  const progress = getCultivationProgress(cultivator);

  // 记录闭关前修为
  const exp_before = progress.cultivation_exp;
  const fateContext = evaluateFateContext(
    cultivator.pre_heaven_fates ?? [],
  );

  // 计算修为获取
  const expResult = calculateCultivationExp(cultivator, years, rng);

  const finalExpGain = Math.max(
    0,
    Math.floor(
      expResult.exp_gained *
        fateContext.retreatExpMultiplier *
        getCultivationBoostRetreatMultiplier(cultivator.condition),
    ),
  );
  const finalInsightGain = Math.max(
    0,
    Math.floor(
      expResult.insight_gained * fateContext.retreatInsightMultiplier,
    ),
  );

  // 更新修为
  progress.cultivation_exp = Math.min(
    exp_before + finalExpGain,
    progress.exp_cap,
  );

  // 更新感悟值（每次闭关都可能获得，非顿悟时0~20，顿悟时20~50）
  if (finalInsightGain > 0) {
    progress.comprehension_insight = Math.min(
      100,
      progress.comprehension_insight + finalInsightGain,
    );
  }

  if (cultivator.condition) {
    cultivator.condition = consumeCultivationBoostStatus(cultivator.condition);
  }

  // 检查是否进入瓶颈期
  const bottleneck_entered = isBottleneckReached(progress);
  if (bottleneck_entered && !progress.bottleneck_state) {
    progress.bottleneck_state = true;
  }

  // 更新年龄
  cultivator.age += years;
  cultivator.closed_door_years_total =
    (cultivator.closed_door_years_total || 0) + years;

  // 创建闭关记录
  const record: RetreatRecord = {
    realm: cultivator.realm,
    realm_stage: cultivator.realm_stage,
    years,
    success: false, // 修炼不算突破
    chance: 0,
    roll: 0,
    timestamp: new Date().toISOString(),
    modifiers: {
      comprehension: 0,
      years: 0,
      failureStreak: 0,
    },
    exp_gained: finalExpGain,
    exp_before,
    exp_after: progress.cultivation_exp,
    insight_gained: finalInsightGain,
    epiphany_triggered: expResult.epiphany_triggered,
  };

  return {
    cultivator,
    summary: {
      exp_gained: finalExpGain,
      exp_before,
      exp_after: progress.cultivation_exp,
      insight_gained: finalInsightGain,
      epiphany_triggered: expResult.epiphany_triggered,
      bottleneck_entered,
      can_breakthrough: canAttemptBreakthrough(progress),
      progress: calculateExpProgress(progress),
    },
    record,
  };
}

/**
 * 尝试突破境界
 */
export function attemptBreakthrough(
  rawCultivator: Cultivator,
  rng: () => number = Math.random,
): BreakthroughResult {
  const cultivator = JSON.parse(JSON.stringify(rawCultivator)) as Cultivator;

  // 确保有修为进度数据
  const progress = getCultivationProgress(cultivator);

  // 检查修为是否足够
  if (!canAttemptBreakthrough(progress)) {
    throw new Error('修为不足，无法突破（至少需要60%修为进度）');
  }

  const fromRealm = cultivator.realm;
  const fromStage = cultivator.realm_stage;
  const nextStage = getNextStage(fromRealm, fromStage);

  if (!nextStage) {
    throw new Error('已达最高境界，无法继续突破');
  }

  // 计算突破类型
  const breakthrough_type = getBreakthroughType(progress);
  const exp_progress = calculateExpProgress(progress);
  const insight_value = progress.comprehension_insight;

  // 使用新的突破概率计算系统
  const breakthroughResult = calculateBreakthroughChance(cultivator);

  if (!breakthroughResult.canAttempt) {
    throw new Error(breakthroughResult.recommendation);
  }

  const finalChance = clamp(breakthroughResult.chance, 0.05, 0.95);
  const modifiers = breakthroughResult.modifiers;

  // roll突破
  const roll = rng();
  const success = roll <= finalChance;

  let lifespanGained = 0;
  const attributeGrowth: Partial<Attributes> = {};
  let historyEntry: BreakthroughHistoryEntry | undefined;
  let insight_change = 0;
  let exp_lost = 0;
  const isMajorBreakthrough = nextStage.realm !== fromRealm;
  const protectMeridiansStatus = getActiveStatus(
    cultivator,
    'protect_meridians',
  );
  const clearMindStatus = getActiveStatus(
    cultivator,
    'clear_mind',
  );

  if (success) {
    // 突破成功
    // 应用属性成长
    const growthRange = getAttributeGrowthRange(
      cultivator.attributes.wisdom,
      { realm: fromRealm, stage: fromStage },
      nextStage,
      isMajorBreakthrough,
    );

    const { attributes: grownAttributes, growth } = applyAttributeGrowth(
      cultivator.attributes,
      getRealmStageAttributeCap(nextStage.realm, nextStage.stage),
      growthRange,
      isMajorBreakthrough,
      rng,
    );

    // 根据突破类型调整属性成长
    if (breakthrough_type === 'perfect') {
      Object.keys(growth).forEach((key) => {
        const attrKey = key as keyof Attributes;
        if (growth[attrKey]) {
          growth[attrKey] = Math.floor(growth[attrKey]! * 1.2);
          grownAttributes[attrKey] =
            cultivator.attributes[attrKey]! + growth[attrKey]!;
        }
      });
    } else if (breakthrough_type === 'forced') {
      Object.keys(growth).forEach((key) => {
        const attrKey = key as keyof Attributes;
        if (growth[attrKey]) {
          growth[attrKey] = Math.floor(growth[attrKey]! * 0.8);
          grownAttributes[attrKey] =
            cultivator.attributes[attrKey]! + growth[attrKey]!;
        }
      });
    }

    cultivator.attributes = grownAttributes;
    Object.assign(attributeGrowth, growth);

    // 更新境界
    cultivator.realm = nextStage.realm;
    cultivator.realm_stage = nextStage.stage;

    // 大境界突破增加寿元
    if (isMajorBreakthrough) {
      lifespanGained = LIFESPAN_BONUS_BY_REALM[nextStage.realm] ?? 0;
      cultivator.lifespan += lifespanGained;
    }

    // 重置修为进度
    progress.cultivation_exp = 0;
    progress.exp_cap = resolveLiveExpCap(nextStage.realm, nextStage.stage);
    progress.breakthrough_failures = 0;
    progress.bottleneck_state = false;
    progress.inner_demon = false;
    progress.deviation_risk = 0;

    // 感悟值变化
    if (breakthrough_type === 'perfect') {
      insight_change = 15;
    } else if (breakthrough_type === 'normal') {
      insight_change = 5;
    } else {
      insight_change = -10;
    }
    progress.comprehension_insight = Math.max(
      0,
      Math.min(100, progress.comprehension_insight + insight_change),
    );

    // 重置闭关年限
    cultivator.closed_door_years_total = 0;

    // 创建突破历史记录
    historyEntry = {
      from_realm: fromRealm,
      from_stage: fromStage,
      to_realm: nextStage.realm,
      to_stage: nextStage.stage,
      age: cultivator.age,
      years_spent: 0,
      exp_progress,
      insight_value,
      breakthrough_type,
    };
  } else {
    // 突破失败
    exp_lost = calculateExpLossOnFailure(progress, rng);
    if (protectMeridiansStatus) {
      exp_lost = Math.floor(
        exp_lost *
          (1 - getProtectMeridiansReductionPercent(protectMeridiansStatus)),
      );
    }
    progress.cultivation_exp = Math.max(0, progress.cultivation_exp - exp_lost);

    // 感悟值降低
    const insightLoss = Math.floor(10 + rng() * 10); // 10-20
    const finalInsightLoss =
      isMajorBreakthrough && clearMindStatus
        ? Math.max(4, Math.floor(insightLoss * 0.7))
        : insightLoss;
    insight_change = -finalInsightLoss;
    progress.comprehension_insight = Math.max(
      0,
      progress.comprehension_insight - finalInsightLoss,
    );

    // 连续失败次数+1
    progress.breakthrough_failures += 1;

    if (isMajorBreakthrough) {
      let deviationGain = getMajorDeviationGain(fromRealm, rng);
      if (clearMindStatus) {
        deviationGain = Math.max(5, Math.floor(deviationGain * 0.65));
      }
      if (protectMeridiansStatus) {
        deviationGain = Math.max(4, Math.floor(deviationGain * 0.8));
      }

      progress.deviation_risk = clamp(
        progress.deviation_risk + deviationGain,
        0,
        100,
      );

    }

    if (
      !clearMindStatus &&
      rng() < getInnerDemonTriggerChance(
        progress.breakthrough_failures,
        isMajorBreakthrough,
      )
    ) {
      progress.inner_demon = true;
    }
  }

  return {
    cultivator,
    summary: {
      success,
      chance: finalChance,
      roll,
      fromRealm,
      fromStage,
      toRealm: success ? nextStage.realm : undefined,
      toStage: success ? nextStage.stage : undefined,
      lifespanGained,
      attributeGrowth,
      exp_progress,
      insight_value,
      exp_lost: success ? undefined : exp_lost,
      breakthrough_type,
      insight_change,
      inner_demon_triggered: progress.inner_demon,
      modifiers,
    },
    historyEntry,
  };
}

/**
 * 获取境界属性上限
 */
export function getRealmAttributeCap(realm: RealmType): number {
  const stageCaps = REALM_STAGE_CAPS[realm];
  if (!stageCaps) return 100;
  return (
    stageCaps.圆满 ?? stageCaps.后期 ?? stageCaps.中期 ?? stageCaps.初期 ?? 100
  );
}

export function getRealmStageAttributeCap(
  realm: RealmType,
  realmStage: RealmStage,
): number {
  const stageCaps = REALM_STAGE_CAPS[realm];
  if (!stageCaps) {
    return getRealmAttributeCap(realm);
  }
  return stageCaps[realmStage] ?? getRealmAttributeCap(realm);
}
