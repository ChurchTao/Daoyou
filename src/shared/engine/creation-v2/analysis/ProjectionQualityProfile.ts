import { QUALITY_ORDER, type Quality } from '@shared/types/constants';
import { CREATION_PROJECTION_QUALITY_TIERS } from '../config/CreationBalance';
import type { EnergyBudget } from '../types';

export interface ProjectionQualityProfile {
  /** 数值投影品质（权威来源）：用于词缀数值、蓝耗/冷却、展示品质等。 */
  quality: Quality;
  qualityOrder: number;
  /** 用于分档映射的预算基准值。当前取 `EnergyBudget.effectiveTotal`。 */
  basisEnergy: number;
}

export function deriveProjectionQualityFromBudget(
  budget: EnergyBudget,
): ProjectionQualityProfile {
  const basisEnergy = Math.max(0, budget.effectiveTotal ?? 0);

  for (const tier of CREATION_PROJECTION_QUALITY_TIERS) {
    if (basisEnergy < tier.maxEnergy) {
      const quality = tier.quality;
      return { quality, qualityOrder: QUALITY_ORDER[quality], basisEnergy };
    }
  }

  // defensive fallback; tiers are expected to end with Infinity
  const quality = '凡品' as const;
  return { quality, qualityOrder: QUALITY_ORDER[quality], basisEnergy };
}

