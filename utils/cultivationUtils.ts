import type { RealmStage, RealmType } from '@/types/constants';
import type {
  CultivationProgress,
  Cultivator,
  SpiritualRoot,
} from '@/types/cultivator';

/**
 * 修为上限配置表
 */
const EXP_CAP_TABLE: Record<RealmType, Record<RealmStage, number>> = {
  炼气: {
    初期: 1000,
    中期: 1500,
    后期: 2200,
    圆满: 3000,
  },
  筑基: {
    初期: 5000,
    中期: 8000,
    后期: 12000,
    圆满: 18000,
  },
  金丹: {
    初期: 30000,
    中期: 50000,
    后期: 80000,
    圆满: 120000,
  },
  元婴: {
    初期: 200000,
    中期: 350000,
    后期: 550000,
    圆满: 800000,
  },
  化神: {
    初期: 1500000,
    中期: 2500000,
    后期: 4000000,
    圆满: 6000000,
  },
  炼虚: {
    初期: 10000000,
    中期: 16000000,
    后期: 25000000,
    圆满: 40000000,
  },
  合体: {
    初期: 70000000,
    中期: 110000000,
    后期: 170000000,
    圆满: 250000000,
  },
  大乘: {
    初期: 400000000,
    中期: 650000000,
    后期: 1000000000,
    圆满: 1500000000,
  },
  渡劫: {
    初期: 2500000000,
    中期: 4000000000,
    后期: 6000000000,
    圆满: 9000000000,
  },
};

/**
 * 基础修为/年配置
 */
const BASE_EXP_PER_YEAR: Record<RealmType, number> = {
  炼气: 50,
  筑基: 150,
  金丹: 400,
  元婴: 1000,
  化神: 2500,
  炼虚: 6000,
  合体: 15000,
  大乘: 35000,
  渡劫: 80000,
};

/**
 * 计算当前境界阶段的修为上限
 */
export function calculateExpCap(
  realm: RealmType,
  realm_stage: RealmStage,
): number {
  return EXP_CAP_TABLE[realm]?.[realm_stage] ?? 1000;
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
    return 50; // 默认值
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
 * 公式：0.5 + (主灵根强度 / 100)
 * 范围：0.7 ~ 1.5
 */
export function calculateSpiritualRootMultiplier(
  spiritual_roots: SpiritualRoot[],
): number {
  const strength = getMainSpiritualRootStrength(spiritual_roots);
  return 0.5 + strength / 100;
}

/**
 * 获取功法系数
 */
export function getCultivationTechniqueMultiplier(
  cultivator: Cultivator,
): number {
  if (!cultivator.cultivations || cultivator.cultivations.length === 0) {
    return 1.0; // 无功法，默认系数
  }

  // 使用最高品级的功法
  const gradeMultipliers: Record<string, number> = {
    黄阶下品: 0.8,
    黄阶中品: 0.85,
    黄阶上品: 0.9,
    玄阶下品: 0.95,
    玄阶中品: 1.0,
    玄阶上品: 1.05,
    地阶下品: 1.1,
    地阶中品: 1.15,
    地阶上品: 1.2,
    天阶下品: 1.25,
    天阶中品: 1.3,
    天阶上品: 1.4,
  };

  let maxMultiplier = 0.8;
  for (const cultivation of cultivator.cultivations) {
    const multiplier = gradeMultipliers[cultivation.grade || ''] ?? 0.8;
    if (multiplier > maxMultiplier) {
      maxMultiplier = multiplier;
    }
  }

  return maxMultiplier;
}

/**
 * 计算悟性系数
 * 公式：1.0 + (悟性 - 50) / 200
 * 范围：0.75 ~ 1.5
 */
export function calculateWisdomMultiplier(wisdom: number): number {
  // 暂时无影响
  return 1.0;
}

/**
 * 计算年限系数
 * 公式：1.0 + log10(闭关年限)
 */
export function calculateYearsMultiplier(years: number): number {
  if (years <= 0) return 1.0;
  return Math.log10(years);
}

/**
 * 计算顿悟触发概率
 * 基于悟性，公式：悟性 / 2000
 */
export function calculateEpiphanyChance(wisdom: number): number {
  return wisdom / 2000;
}

/**
 * 计算单次闭关获得的修为
 * 公式：基础修为 × 灵根系数 × 功法系数 × 悟性系数 × 年限系数 × 随机波动
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
  const baseExp = BASE_EXP_PER_YEAR[cultivator.realm] ?? 50;

  // 2. 灵根系数
  const spiritualRootMultiplier = calculateSpiritualRootMultiplier(
    cultivator.spiritual_roots,
  );

  // 3. 功法系数
  const techniqueMultiplier = getCultivationTechniqueMultiplier(cultivator);

  // 4. 悟性系数
  const wisdomMultiplier = calculateWisdomMultiplier(
    cultivator.attributes.wisdom,
  );

  // 5. 年限系数
  const yearsMultiplier = calculateYearsMultiplier(years);

  // 6. 随机波动 (±10%)
  const randomFactor = 0.9 + rng() * 0.2;

  // 7. 检查是否触发顿悟
  const epiphanyChance = calculateEpiphanyChance(cultivator.attributes.wisdom);
  const epiphany_triggered = rng() < epiphanyChance;

  // 8. 计算基础修为获取
  let exp_gained =
    baseExp *
    years *
    spiritualRootMultiplier *
    techniqueMultiplier *
    wisdomMultiplier *
    yearsMultiplier *
    randomFactor;

  // 9. 顿悟加成
  let insight_gained = 0;
  if (epiphany_triggered) {
    exp_gained *= 2; // 修为翻倍
    insight_gained = Math.floor(20 + rng() * 30); // 20-50感悟值
  }

  // 10. 如果处于瓶颈期，修为获取减半
  const progress = cultivator.cultivation_progress;
  if (progress?.bottleneck_state) {
    exp_gained *= 0.5;
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
 * 判断修为是否达到瓶颈期（90%）
 */
export function isBottleneckReached(progress: CultivationProgress): boolean {
  return calculateExpProgress(progress) >= 90;
}

/**
 * 判断是否可以尝试突破
 * 至少需要60%修为进度
 */
export function canAttemptBreakthrough(progress: CultivationProgress): boolean {
  return calculateExpProgress(progress) >= 60;
}

/**
 * 获取突破类型
 */
export function getBreakthroughType(
  progress: CultivationProgress,
): 'forced' | 'normal' | 'perfect' {
  const expProgress = calculateExpProgress(progress);

  if (expProgress >= 100 && progress.comprehension_insight >= 50) {
    return 'perfect';
  } else if (expProgress >= 80) {
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

  let baseLossRatio: number;
  let insightProtectionDivisor: number;

  switch (breakthroughType) {
    case 'forced':
      baseLossRatio = 0.5 + rng() * 0.2; // 50%-70%
      insightProtectionDivisor = 500;
      break;
    case 'normal':
      baseLossRatio = 0.3 + rng() * 0.2; // 30%-50%
      insightProtectionDivisor = 300;
      break;
    case 'perfect':
      baseLossRatio = 0.2 + rng() * 0.1; // 20%-30%
      insightProtectionDivisor = 200;
      break;
  }

  const insightProtection =
    progress.comprehension_insight / insightProtectionDivisor;
  const actualLossRatio = baseLossRatio * (1 - insightProtection);

  return Math.floor(progress.cultivation_exp * actualLossRatio);
}
