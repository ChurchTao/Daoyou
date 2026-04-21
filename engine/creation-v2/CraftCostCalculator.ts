import { Quality, QUALITY_ORDER, QUALITY_VALUES } from '@/types/constants';

export const CRAFT_COST_CONFIG = {
  spiritStone: {
    base: 400,
    multiplier: 2,
  },
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

export type CraftResourceType = 'spiritStone' | 'comprehension';

export function calculateCraftCost(
  maxQuality: Quality,
  resourceType: CraftResourceType,
): number {
  if (resourceType === 'spiritStone') {
    const config = CRAFT_COST_CONFIG.spiritStone;
    const qualityLevel = QUALITY_ORDER[maxQuality];
    return config.base * Math.pow(config.multiplier, qualityLevel);
  }

  return CRAFT_COST_CONFIG.comprehension[maxQuality] || 10;
}

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

export function calculateMaxQuality(
  materials: Array<{ rank: Quality }>,
): Quality {
  let maxIndex = 0;
  for (const material of materials) {
    const index = QUALITY_VALUES.indexOf(material.rank);
    if (index > maxIndex) maxIndex = index;
  }

  return QUALITY_VALUES[maxIndex];
}
