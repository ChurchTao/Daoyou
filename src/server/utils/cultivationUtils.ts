import {
  BASE_EXP_PER_YEAR,
  EXP_CAP_TABLE,
} from '@shared/config/cultivationProgress';
import {
  BOTTLENECK_EXP_PENALTY,
  BOTTLENECK_THRESHOLD,
  BREAKTHROUGH_MIN_PROGRESS,
  DEFAULT_SPIRITUAL_ROOT_STRENGTH,
  EPIPHANY_CHANCE,
  EPIPHANY_EXP_MULTIPLIER,
  EPIPHANY_INSIGHT_MIN,
  EPIPHANY_INSIGHT_RANGE,
  FAILURE_LOSS_PARAMS,
  MAX_NORMAL_INSIGHT,
  NO_TECHNIQUE_MULTIPLIER,
  NORMAL_BREAKTHROUGH_THRESHOLD,
  NORMAL_INSIGHT_SCALE,
  PERFECT_BREAKTHROUGH_INSIGHT,
  RANDOM_FACTOR_LOW,
  RANDOM_FACTOR_RANGE,
  SPIRITUAL_ROOT_BASE,
  TECHNIQUE_FALLBACK_QUALITY,
  TECHNIQUE_MIN_MULTIPLIER,
  TECHNIQUE_QUALITY_MULTIPLIERS,
  YEARS_MULTIPLIER_BASE,
  YEARS_MULTIPLIER_SCALE,
} from '@shared/config/cultivationTuning';
import type { RealmStage, RealmType } from '@shared/types/constants';
import type {
  CultivationProgress,
  Cultivator,
  SpiritualRoot,
} from '@shared/types/cultivator';

/**
 * 计算当前境界阶段的修为上限
 */
export function calculateExpCap(
  realm: RealmType,
  realm_stage: RealmStage,
): number {
  return EXP_CAP_TABLE[realm]?.[realm_stage] ?? EXP_CAP_TABLE['炼气']['初期'];
}

export function getCultivationProgress(
  cultivator: Cultivator,
): CultivationProgress {
  // 确保有修为进度数据
  if (
    !cultivator.cultivation_progress ||
    !cultivator.cultivation_progress.exp_cap
  ) {
    cultivator.cultivation_progress = createDefaultCultivationProgress(
      cultivator.realm,
      cultivator.realm_stage,
    );
  }
  return cultivator.cultivation_progress;
}

export function getOrInitCultivationProgress(
  cultivation_progress: CultivationProgress,
  realm: RealmType,
  realm_stage: RealmStage,
): CultivationProgress {
  return cultivation_progress && cultivation_progress.exp_cap
    ? cultivation_progress
    : createDefaultCultivationProgress(realm, realm_stage);
}

/**
 * 创建默认的修为进度数据
 */
export function createDefaultCultivationProgress(
  realm: RealmType,
  realm_stage: RealmStage,
): CultivationProgress {
  return {
    cultivation_exp: 0,
    exp_cap: calculateExpCap(realm, realm_stage),
    comprehension_insight: 0,
    breakthrough_failures: 0,
    bottleneck_state: false,
    inner_demon: false,
    deviation_risk: 0,
  };
}

/**
 * 获取主灵根强度（最高strength的灵根）
 */
export function getMainSpiritualRootStrength(
  spiritual_roots: SpiritualRoot[],
): number {
  if (!spiritual_roots || spiritual_roots.length === 0) {
    return DEFAULT_SPIRITUAL_ROOT_STRENGTH;
  }

  let maxStrength = spiritual_roots[0].strength;
  for (const root of spiritual_roots) {
    if (root.strength > maxStrength) {
      maxStrength = root.strength;
    }
  }

  return maxStrength;
}

/**
 * 计算灵根系数
 * 公式：SPIRITUAL_ROOT_BASE + (主灵根强度 / 100)
 */
export function calculateSpiritualRootMultiplier(
  spiritual_roots: SpiritualRoot[],
): number {
  const strength = getMainSpiritualRootStrength(spiritual_roots);
  return SPIRITUAL_ROOT_BASE + strength / 100;
}

/**
 * 获取功法系数
 */
export function getCultivationTechniqueMultiplier(
  cultivator: Cultivator,
): number {
  if (!cultivator.cultivations || cultivator.cultivations.length === 0) {
    return NO_TECHNIQUE_MULTIPLIER;
  }

  let maxMultiplier = TECHNIQUE_MIN_MULTIPLIER;
  for (const cultivation of cultivator.cultivations) {
    const multiplier =
      TECHNIQUE_QUALITY_MULTIPLIERS[cultivation.quality ?? TECHNIQUE_FALLBACK_QUALITY] ??
      TECHNIQUE_MIN_MULTIPLIER;
    if (multiplier > maxMultiplier) {
      maxMultiplier = multiplier;
    }
  }

  return maxMultiplier;
}

/**
 * 计算年限系数
 * 公式：YEARS_MULTIPLIER_BASE + YEARS_MULTIPLIER_SCALE × √(log₁₀(years + 1))
 */
export function calculateYearsMultiplier(years: number): number {
  if (years <= 0) return 1.0;
  return YEARS_MULTIPLIER_BASE + YEARS_MULTIPLIER_SCALE * Math.sqrt(Math.log10(years + 1));
}

/**
 * 顿悟触发概率（固定 EPIPHANY_CHANCE）
 */
export function calculateEpiphanyChance(): number {
  return EPIPHANY_CHANCE;
}

/**
 * 计算非顿悟时的常规感悟值获取
 * 公式：min(MAX_NORMAL_INSIGHT, floor(√years × NORMAL_INSIGHT_SCALE × rng))
 */
export function calculateNormalInsightGain(
  years: number,
  rng: () => number = Math.random,
): number {
  if (years <= 0) return 0;
  const base = Math.sqrt(years) * NORMAL_INSIGHT_SCALE * rng();
  return Math.min(MAX_NORMAL_INSIGHT, Math.floor(base));
}

/**
 * 计算单次闭关获得的修为
 * 公式：基础修为 × 灵根系数 × 功法系数 × 年限系数 × 随机波动
 */
export interface CultivationExpResult {
  exp_gained: number; // 获得的修为
  epiphany_triggered: boolean; // 是否触发顿悟
  insight_gained: number; // 获得的感悟值
}

export function calculateCultivationExp(
  cultivator: Cultivator,
  years: number,
  rng: () => number = Math.random,
): CultivationExpResult {
  // 1. 基础修为
  const baseExp = BASE_EXP_PER_YEAR[cultivator.realm] ?? BASE_EXP_PER_YEAR['炼气'];

  // 2. 灵根系数
  const spiritualRootMultiplier = calculateSpiritualRootMultiplier(
    cultivator.spiritual_roots,
  );

  // 3. 功法系数
  const techniqueMultiplier = getCultivationTechniqueMultiplier(cultivator);

  // 4. 年限系数
  const yearsMultiplier = calculateYearsMultiplier(years);

  // 5. 随机波动
  const randomFactor = RANDOM_FACTOR_LOW + rng() * RANDOM_FACTOR_RANGE;

  // 6. 顿悟判定
  const epiphanyChance = calculateEpiphanyChance();
  const epiphany_triggered = rng() < epiphanyChance;

  // 7. 计算基础修为获取
  let exp_gained =
    baseExp *
    years *
    spiritualRootMultiplier *
    techniqueMultiplier *
    yearsMultiplier *
    randomFactor;

  // 8. 顿悟加成：修为翻倍 + 感悟值
  let insight_gained = 0;
  if (epiphany_triggered) {
    exp_gained *= EPIPHANY_EXP_MULTIPLIER;
    insight_gained = Math.floor(EPIPHANY_INSIGHT_MIN + rng() * EPIPHANY_INSIGHT_RANGE);
  } else {
    // 9. 非顿悟时的常规感悟值
    insight_gained = calculateNormalInsightGain(years, rng);
  }

  // 10. 如果处于瓶颈期，修为获取衰减
  const progress = cultivator.cultivation_progress;
  if (progress?.bottleneck_state) {
    exp_gained *= BOTTLENECK_EXP_PENALTY;
  }

  return {
    exp_gained: Math.floor(exp_gained),
    epiphany_triggered,
    insight_gained,
  };
}

/**
 * 计算修为进度百分比
 */
export function calculateExpProgress(progress: CultivationProgress): number {
  if (!progress.exp_cap || progress.exp_cap === 0) return 0;
  return Math.min(100, (progress.cultivation_exp / progress.exp_cap) * 100);
}

/**
 * 判断修为是否达到瓶颈期
 */
export function isBottleneckReached(progress: CultivationProgress): boolean {
  return calculateExpProgress(progress) >= BOTTLENECK_THRESHOLD;
}

/**
 * 判断是否可以尝试突破
 */
export function canAttemptBreakthrough(progress: CultivationProgress): boolean {
  return calculateExpProgress(progress) >= BREAKTHROUGH_MIN_PROGRESS;
}

/**
 * 获取突破类型
 */
export function getBreakthroughType(
  progress: CultivationProgress,
): 'forced' | 'normal' | 'perfect' {
  const expProgress = calculateExpProgress(progress);

  if (expProgress >= 100 && progress.comprehension_insight >= PERFECT_BREAKTHROUGH_INSIGHT) {
    return 'perfect';
  } else if (expProgress >= NORMAL_BREAKTHROUGH_THRESHOLD) {
    return 'normal';
  } else {
    return 'forced';
  }
}

/**
 * 计算突破失败时的修为损失
 */
export function calculateExpLossOnFailure(
  progress: CultivationProgress,
  rng: () => number = Math.random,
): number {
  const breakthroughType = getBreakthroughType(progress);
  const params = FAILURE_LOSS_PARAMS[breakthroughType];

  const baseLossRatio = params.baseLow + rng() * params.baseRange;
  const insightProtection = progress.comprehension_insight / params.insightDivisor;
  const actualLossRatio = baseLossRatio * (1 - insightProtection);

  return Math.floor(progress.cultivation_exp * actualLossRatio);
}
