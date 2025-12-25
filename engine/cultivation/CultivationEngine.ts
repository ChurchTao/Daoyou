import {
  type RealmStage,
  type RealmType,
  REALM_STAGE_CAPS,
} from '@/types/constants';
import type {
  Attributes,
  BreakthroughHistoryEntry,
  Cultivator,
  RetreatRecord,
} from '@/types/cultivator';
import {
  type BreakthroughModifiers,
  applyAttributeGrowth,
  calculateBreakthroughChance,
  getAttributeGrowthRange,
  getNextStage,
} from '@/utils/breakthroughEngine';
import {
  calculateCultivationExp,
  calculateExpCap,
  calculateExpLossOnFailure,
  calculateExpProgress,
  canAttemptBreakthrough,
  getBreakthroughType,
  getCultivationProgress,
  isBottleneckReached,
} from '@/utils/cultivationUtils';

const LIFESPAN_BONUS_BY_REALM: Record<string, number> = {
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
    yearsSpent: number;
    chance: number;
    roll: number;
    fromRealm: RealmType;
    fromStage: RealmStage;
    toRealm?: RealmType;
    toStage?: RealmStage;
    lifespanGained: number;
    attributeGrowth: Partial<Attributes>;
    lifespanDepleted: boolean;
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

  // 计算修为获取
  const expResult = calculateCultivationExp(cultivator, years, rng);

  // 更新修为
  progress.cultivation_exp = Math.min(
    exp_before + expResult.exp_gained,
    progress.exp_cap,
  );

  // 更新感悟值
  if (expResult.epiphany_triggered) {
    progress.comprehension_insight = Math.min(
      100,
      progress.comprehension_insight + expResult.insight_gained,
    );

    // 应用顿悟buff
    const now = new Date();
    progress.last_epiphany_at = now.toISOString();
    const buffExpires = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3天
    progress.epiphany_buff_expires_at = buffExpires.toISOString();
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
    exp_gained: expResult.exp_gained,
    exp_before,
    exp_after: progress.cultivation_exp,
    insight_gained: expResult.insight_gained,
    epiphany_triggered: expResult.epiphany_triggered,
  };

  return {
    cultivator,
    summary: {
      exp_gained: expResult.exp_gained,
      exp_before,
      exp_after: progress.cultivation_exp,
      insight_gained: expResult.insight_gained,
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
  years: number = 0,
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

  // 计算突破成功率
  const { chance: baseChance, modifiers } = calculateBreakthroughChance(
    cultivator,
    years,
  );

  // 应用修为进度系数（优化：降低惩罚，提高奖励）
  let progressMultiplier = 1.0;
  if (exp_progress < 70) {
    progressMultiplier = 0.5;
  } else if (exp_progress < 80) {
    progressMultiplier = 0.75;
  } else if (exp_progress < 90) {
    progressMultiplier = 0.95;
  } else if (exp_progress < 100) {
    progressMultiplier = 1.05;
  } else {
    progressMultiplier = 1.2;
  }

  // 应用感悟系数（优化：提升感悟价值）
  const insightMultiplier = 1.0 + insight_value / 150;

  // 应用心魔debuff
  const demonMultiplier = progress.inner_demon ? 0.95 : 1.0;

  // 最终成功率
  const finalChance =
    baseChance * progressMultiplier * insightMultiplier * demonMultiplier;

  // roll突破
  const roll = rng();
  const success = roll <= finalChance;

  let lifespanGained = 0;
  const attributeGrowth: Partial<Attributes> = {};
  let historyEntry: BreakthroughHistoryEntry | undefined;
  let insight_change = 0;
  let exp_lost = 0;

  if (success) {
    // 突破成功
    // 应用属性成长
    const isMajor = nextStage.realm !== fromRealm;
    const growthRange = getAttributeGrowthRange(
      cultivator.attributes.wisdom,
      { realm: fromRealm, stage: fromStage },
      nextStage,
      isMajor,
    );

    const { attributes: grownAttributes, growth } = applyAttributeGrowth(
      cultivator.attributes,
      getRealmStageAttributeCap(nextStage.realm, nextStage.stage),
      growthRange,
      isMajor,
      rng,
    );

    // 根据突破类型调整属性成长
    if (breakthrough_type === 'perfect') {
      Object.keys(growth).forEach((key) => {
        const attrKey = key as keyof Attributes;
        if (growth[attrKey]) {
          growth[attrKey] = Math.floor(growth[attrKey]! * 1.2);
          grownAttributes[attrKey] =
            cultivator.attributes[attrKey] + growth[attrKey]!;
        }
      });
    } else if (breakthrough_type === 'forced') {
      Object.keys(growth).forEach((key) => {
        const attrKey = key as keyof Attributes;
        if (growth[attrKey]) {
          growth[attrKey] = Math.floor(growth[attrKey]! * 0.8);
          grownAttributes[attrKey] =
            cultivator.attributes[attrKey] + growth[attrKey]!;
        }
      });
    }

    cultivator.attributes = grownAttributes;
    Object.assign(attributeGrowth, growth);

    // 更新境界
    cultivator.realm = nextStage.realm;
    cultivator.realm_stage = nextStage.stage;

    // 大境界突破增加寿元
    if (nextStage.realm !== fromRealm) {
      lifespanGained = LIFESPAN_BONUS_BY_REALM[nextStage.realm] ?? 0;
      cultivator.lifespan += lifespanGained;
    }

    // 重置修为进度
    progress.cultivation_exp = 0;
    progress.exp_cap = calculateExpCap(nextStage.realm, nextStage.stage);
    progress.breakthrough_failures = 0;
    progress.bottleneck_state = false;
    progress.inner_demon = false;

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
      years_spent: years,
      exp_progress,
      insight_value,
      breakthrough_type,
    };
  } else {
    // 突破失败
    exp_lost = calculateExpLossOnFailure(progress, rng);
    progress.cultivation_exp = Math.max(0, progress.cultivation_exp - exp_lost);

    // 感悟值降低
    const insightLoss = Math.floor(10 + rng() * 10); // 10-20
    insight_change = -insightLoss;
    progress.comprehension_insight = Math.max(
      0,
      progress.comprehension_insight - insightLoss,
    );

    // 连续失败次数+1
    progress.breakthrough_failures += 1;

    // 检查心魔触发
    if (progress.breakthrough_failures >= 3) {
      progress.inner_demon = true;
    }
  }

  // 检查寿元是否耗尽
  const lifespanDepleted = !success && cultivator.age >= cultivator.lifespan;

  return {
    cultivator,
    summary: {
      success,
      yearsSpent: years,
      chance: finalChance,
      roll,
      fromRealm,
      fromStage,
      toRealm: success ? nextStage.realm : undefined,
      toStage: success ? nextStage.stage : undefined,
      lifespanGained,
      attributeGrowth,
      lifespanDepleted,
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
