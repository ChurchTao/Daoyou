import { Quality, QUALITY_ORDER, QUALITY_VALUES } from '@/types/constants';

/**
 * 造物资源消耗配置
 */
export const CRAFT_COST_CONFIG = {
  // 灵石消耗（炼丹/炼器）- 指数增长
  spiritStone: {
    base: 400, // 凡品基础消耗
    multiplier: 2, // 每升一品质翻倍
  },
  // 道心感悟消耗（藏经阁）- 分段固定值（上限100）
  comprehension: {
    凡品: 5,
    灵品: 10,
    玄品: 15,
    真品: 25,
    地品: 40,
    天品: 60,
    仙品: 80,
    神品: 100,
  },
} as const;

/**
 * 造物资源类型
 */
export type CraftResourceType = 'spiritStone' | 'comprehension';

/**
 * 计算资源消耗
 * @param maxQuality 材料最高品质
 * @param resourceType 资源类型
 * @returns 消耗量
 */
export function calculateCraftCost(
  maxQuality: Quality,
  resourceType: CraftResourceType,
): number {
  if (resourceType === 'spiritStone') {
    const config = CRAFT_COST_CONFIG.spiritStone;
    const qualityLevel = QUALITY_ORDER[maxQuality];
    return config.base * Math.pow(config.multiplier, qualityLevel);
  }
  // 感悟使用查表法
  return CRAFT_COST_CONFIG.comprehension[maxQuality] || 10;
}

/**
 * 获取消耗描述（用于前端展示）
 * @param maxQuality 材料最高品质
 * @param craftType 造物类型
 * @returns 消耗描述对象
 */
export function getCostDescription(
  maxQuality: Quality,
  craftType: string,
): { spiritStones?: number; comprehension?: number } {
  if (craftType === 'alchemy' || craftType === 'refine') {
    return { spiritStones: calculateCraftCost(maxQuality, 'spiritStone') };
  }
  if (craftType === 'create_skill' || craftType === 'create_gongfa') {
    return { comprehension: calculateCraftCost(maxQuality, 'comprehension') };
  }
  return {};
}

/**
 * 从材料数组中计算最高品质
 * @param materials 材料数组（包含 rank 属性）
 * @returns 最高品质
 */
export function calculateMaxQuality(
  materials: Array<{ rank: Quality }>,
): Quality {
  let maxIndex = 0;
  for (const mat of materials) {
    const index = QUALITY_VALUES.indexOf(mat.rank);
    if (index > maxIndex) maxIndex = index;
  }
  return QUALITY_VALUES[maxIndex];
}
