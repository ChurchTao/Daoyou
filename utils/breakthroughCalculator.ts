/**
 * 新版突破概率计算系统
 *
 * 基于修为进度 + 感悟值的全新突破算法
 * 取代原 breakthroughEngine.ts 中的 calculateBreakthroughChance
 */

import {
  REALM_STAGE_VALUES,
  REALM_VALUES,
  type RealmStage,
  type RealmType,
} from '@/types/constants';
import type {
  Attributes,
  CultivationProgress,
  Cultivator,
} from '@/types/cultivator';
import { format } from 'd3-format';
import { calculateExpProgress, getBreakthroughType } from './cultivationUtils';
import { getRealmStageAttributeCap } from './cultivatorUtils';

const REALM_ORDER = [...REALM_VALUES];
const STAGE_ORDER = [...REALM_STAGE_VALUES];
const ATTRIBUTE_KEYS: Array<keyof Attributes> = [
  'vitality',
  'spirit',
  'wisdom',
  'speed',
  'willpower',
];

const LIFESPAN_BONUS_BY_REALM: Partial<Record<RealmType, number>> = {
  筑基: 200,
  金丹: 500,
  元婴: 1200,
  化神: 2000,
  炼虚: 3000,
  合体: 4000,
  大乘: 5000,
  渡劫: 8000,
};

/**
 * 突破修正系数详情
 */
export interface BreakthroughModifiers {
  baseChance: number; // 基础成功率
  realmDifficulty: number; // 境界难度系数
  progressMultiplier: number; // 修为进度系数
  insightMultiplier: number; // 感悟系数
  wisdomMultiplier: number; // 悟性系数
  demonPenalty: number; // 心魔惩罚
  finalChance: number; // 最终成功率
}

/**
 * 突破概率计算结果
 */
export interface BreakthroughChanceResult {
  chance: number; // 最终成功率
  modifiers: BreakthroughModifiers; // 各项修正系数
  breakthroughType: 'forced' | 'normal' | 'perfect'; // 突破类型
  nextStage: { realm: RealmType; stage: RealmStage } | null; // 下一境界
  canAttempt: boolean; // 是否可以尝试突破
  recommendation: string; // 突破建议
}

/**
 * 计算突破成功率（新版）
 *
 * @param cultivator 角色对象
 * @returns 突破概率计算结果
 */
export function calculateBreakthroughChance(
  cultivator: Cultivator,
): BreakthroughChanceResult {
  // 获取修为进度数据
  const progress = cultivator.cultivation_progress;
  if (!progress) {
    throw new Error('角色缺少修为进度数据');
  }

  // 检查是否可以突破（修为至少60%）
  const expProgress = calculateExpProgress(progress);
  if (expProgress < 60) {
    return createInsufficientExpResult(progress);
  }

  // 获取突破类型
  const breakthroughType = getBreakthroughType(progress);

  // 获取下一境界
  const nextStage = getNextStage(cultivator.realm, cultivator.realm_stage);
  if (!nextStage) {
    return createMaxRealmResult();
  }

  const isMajorBreakthrough = nextStage.realm !== cultivator.realm;

  // 1. 基础成功率（根据突破类型）
  const baseChance = getBaseChanceByType(breakthroughType, isMajorBreakthrough);

  // 2. 境界难度系数（境界越高越难）
  const realmDifficulty = calculateRealmDifficulty(cultivator.realm);

  // 3. 修为进度系数
  const progressMultiplier = calculateProgressMultiplier(expProgress);

  // 4. 感悟系数（新系统核心）
  const insightMultiplier = calculateInsightMultiplier(
    progress.comprehension_insight,
  );

  // 5. 悟性系数（增强悟性的作用）
  const wisdomMultiplier = calculateWisdomMultiplier(
    cultivator.attributes.wisdom,
  );

  // 6. 心魔惩罚
  const demonPenalty = progress.inner_demon ? 0.95 : 1.0;

  // 计算最终成功率
  const finalChance = Math.min(
    1.0,
    baseChance *
      realmDifficulty *
      progressMultiplier *
      insightMultiplier *
      wisdomMultiplier *
      demonPenalty,
  );

  // 生成突破建议
  const recommendation = generateRecommendation(
    breakthroughType,
    expProgress,
    progress.comprehension_insight,
    finalChance,
    progress.bottleneck_state,
  );

  return {
    chance: finalChance,
    modifiers: {
      baseChance,
      realmDifficulty,
      progressMultiplier,
      insightMultiplier,
      wisdomMultiplier,
      demonPenalty,
      finalChance,
    },
    breakthroughType,
    nextStage,
    canAttempt: true,
    recommendation,
  };
}

export { LIFESPAN_BONUS_BY_REALM };

/**
 * 获取下一境界
 */
/**
 * 获取下一境界
 */
export function getNextStage(
  realm: RealmType,
  stage: RealmStage,
): { realm: RealmType; stage: RealmStage } | null {
  const stageIndex = STAGE_ORDER.indexOf(stage);

  if (stageIndex === -1) return null;

  // 如果不是圆满，则进入下一阶段
  if (stageIndex < STAGE_ORDER.length - 1) {
    return { realm, stage: STAGE_ORDER[stageIndex + 1] };
  }

  // 圆满后进入下一大境界的初期
  const realmIndex = REALM_ORDER.indexOf(realm);
  if (realmIndex === -1 || realmIndex >= REALM_ORDER.length - 1) {
    return null; // 已达最高境界
  }

  return { realm: REALM_ORDER[realmIndex + 1], stage: '初期' };
}

/**
 * 根据突破类型获取基础成功率
 *
 * 强行突破：40%（小） / 20%（大）
 * 常规突破：60%（小） / 40%（大）
 * 圆满突破：80%（小） / 60%（大）
 */
function getBaseChanceByType(
  type: 'forced' | 'normal' | 'perfect',
  isMajor: boolean,
): number {
  const rates = {
    forced: { minor: 0.4, major: 0.2 },
    normal: { minor: 0.6, major: 0.4 },
    perfect: { minor: 0.8, major: 0.6 },
  };

  return isMajor ? rates[type].major : rates[type].minor;
}

/**
 * 计算境界难度系数
 *
 * 境界越高，突破越难
 * 炼气：1.0
 * 筑基：0.9
 * 金丹：0.81
 * 元婴：0.72
 * ...
 */
function calculateRealmDifficulty(realm: RealmType): number {
  const realmIndex = REALM_ORDER.indexOf(realm);
  // 使用0.9的衰减率
  return Math.pow(0.9, realmIndex);
}

/**
 * 计算修为进度系数
 *
 * 60-69%: 0.6
 * 70-79%: 0.8
 * 80-89%: 0.95
 * 90-99%: 1.1
 * 100%:   1.25
 */
function calculateProgressMultiplier(progress: number): number {
  if (progress >= 100) return 1.25;
  if (progress >= 90) return 1.1;
  if (progress >= 80) return 0.95;
  if (progress >= 70) return 0.8;
  return 0.6; // 60-69%
}

/**
 * 计算感悟系数（新系统核心）
 *
 * 感悟值越高，成功率加成越大
 * 公式：1.0 + (感悟值 / 100) × 0.25
 *
 * 0感悟：  1.0倍（无加成）
 * 50感悟： 1.125倍
 * 100感悟：1.25倍
 */
function calculateInsightMultiplier(insight: number): number {
  return 1.0 + (insight / 100) * 0.25;
}

/**
 * 计算悟性系数（增强版）
 *
 * 悟性影响突破成功率，且上限更高
 * 公式：1.0 + log10(悟性) / 30
 */
function calculateWisdomMultiplier(wisdom: number): number {
  const modifier = Math.log10(wisdom) / 30;
  return Math.max(0.8, Math.min(1.2, 1.0 + modifier));
}

/**
 * 生成突破建议
 */
function generateRecommendation(
  type: 'forced' | 'normal' | 'perfect',
  expProgress: number,
  insight: number,
  finalChance: number,
  bottleneck: boolean,
): string {
  // 成功率评估
  if (finalChance >= 0.8) {
    return '成功率极高，可放心突破！';
  }

  if (finalChance >= 0.6) {
    return '成功率较高，值得一试。';
  }

  if (finalChance >= 0.4) {
    if (type === 'forced') {
      return '强行突破风险较大，建议继续积累修为。';
    }
    return '成功率一般，可尝试突破或继续积累。';
  }

  // 低成功率情况
  const suggestions: string[] = [];

  if (expProgress < 100) {
    suggestions.push('修为未满');
  }

  if (insight < 50) {
    suggestions.push('感悟不足');
  }

  if (bottleneck) {
    suggestions.push('处于瓶颈期，建议通过副本、战斗提升感悟');
  }

  if (suggestions.length > 0) {
    return `成功率偏低（${suggestions.join('、')}），建议继续积累后再尝试。`;
  }

  return '成功率较低，请谨慎决策。';
}

/**
 * 修为不足时的返回结果
 */
function createInsufficientExpResult(
  progress: CultivationProgress,
): BreakthroughChanceResult {
  return {
    chance: 0,
    modifiers: {
      baseChance: 0,
      realmDifficulty: 0,
      progressMultiplier: 0,
      insightMultiplier: 0,
      wisdomMultiplier: 0,
      demonPenalty: 0,
      finalChance: 0,
    },
    breakthroughType: 'forced',
    nextStage: null,
    canAttempt: false,
    recommendation: `修为不足，需达到60%以上才可尝试突破（当前${calculateExpProgress(progress)}%）`,
  };
}

/**
 * 已达最高境界时的返回结果
 */
function createMaxRealmResult(): BreakthroughChanceResult {
  return {
    chance: 0,
    modifiers: {
      baseChance: 0,
      realmDifficulty: 0,
      progressMultiplier: 0,
      insightMultiplier: 0,
      wisdomMultiplier: 0,
      demonPenalty: 0,
      finalChance: 0,
    },
    breakthroughType: 'forced',
    nextStage: null,
    canAttempt: false,
    recommendation: '已达最高境界，无法继续突破',
  };
}

/**
 * 获取突破成功率的详细说明文本
 */
export function getBreakthroughChanceExplanation(
  result: BreakthroughChanceResult,
): string {
  if (!result.canAttempt) {
    return result.recommendation;
  }

  const { modifiers, breakthroughType } = result;
  const typeLabels = {
    forced: '强行突破',
    normal: '常规突破',
    perfect: '圆满突破',
  };

  return `
【突破类型】${typeLabels[breakthroughType]}
【最终成功率】${format('.1%')(modifiers.finalChance)}

【各项系数】
• 基础成功率：${format('.0%')(modifiers.baseChance)}
• 境界难度：×${format('.2f')(modifiers.realmDifficulty)}
• 修为进度：×${format('.2f')(modifiers.progressMultiplier)}
• 感悟加成：×${format('.2f')(modifiers.insightMultiplier)}
• 悟性加成：×${format('.2f')(modifiers.wisdomMultiplier)}
${modifiers.demonPenalty < 1.0 ? `• 心魔惩罚：×${format('.2f')(modifiers.demonPenalty)}\n` : ''}
【建议】${result.recommendation}
  `.trim();
}

// ==================== 属性成长相关工具函数 ====================

/**
 * 获取悟性修正系数
 */
function getComprehensionModifier(wisdom: number): number {
  // 悟性越高，修正倍率越高，最高不超过0.18
  return Math.min(0.18, Math.max((wisdom - 50) / 1000, 0));
}

/**
 * 获取属性增长范围
 * @param wisdom 悟性
 * @param fromStage 当前境界
 * @param nextStage 下一境界
 * @param isMajor 是否大境界突破
 * @returns 属性增长范围
 */
export function getAttributeGrowthRange(
  wisdom: number,
  fromStage: { realm: RealmType; stage: RealmStage },
  nextStage: { realm: RealmType; stage: RealmStage },
  isMajor: boolean,
): { min: number; max: number } {
  const fromCap = getRealmStageAttributeCap(fromStage.realm, fromStage.stage);
  const nextCap = getRealmStageAttributeCap(nextStage.realm, nextStage.stage);
  const capDiff = nextCap - fromCap;
  const wisdomModifier = getComprehensionModifier(wisdom);
  const min = Math.round(capDiff * (0.7 + wisdomModifier));
  const max = Math.round(capDiff * (0.8 + wisdomModifier));
  const majorMin = Math.round(capDiff * (0.8 + wisdomModifier));
  const majorMax = Math.round(capDiff * (0.9 + wisdomModifier));
  return isMajor ? { min: majorMin, max: majorMax } : { min, max };
}

/**
 * 应用属性成长
 */
export function applyAttributeGrowth(
  attributes: Attributes,
  cap: number,
  range: { min: number; max: number },
  isMajor: boolean,
  rng: () => number = Math.random,
): { attributes: Attributes; growth: Partial<Attributes> } {
  const updated = { ...attributes };
  const growth: Partial<Attributes> = {};

  ATTRIBUTE_KEYS.forEach((key) => {
    const delta = randomInt(range.min, range.max, rng);
    const current = Math.min(updated[key]!, cap);
    if (current !== updated[key]) {
      updated[key] = current;
    }
    const boosted = Math.min(current + delta, cap);
    growth[key] = boosted - current;
    updated[key] = boosted;
  });

  return { attributes: updated, growth };
}

/**
 * 随机整数
 */
function randomInt(min: number, max: number, rng: () => number): number {
  if (max <= min) return min;
  return Math.floor(rng() * (max - min + 1)) + min;
}
