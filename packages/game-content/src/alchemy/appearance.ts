import type { PillAppearanceGrade } from '@daoyou/game-domain/consumables';

export interface PillAppearanceConfig {
  grade: PillAppearanceGrade;
  label: string;
  effectMultiplier: number;
  toxicityMultiplier: number;
  colorClass: string;
}

export const PILL_APPEARANCE_CONFIG: Record<
  PillAppearanceGrade,
  PillAppearanceConfig
> = {
  low: {
    grade: 'low',
    label: '下品',
    effectMultiplier: 0.9,
    toxicityMultiplier: 1.35,
    colorClass: 'text-tier-fan',
  },
  middle: {
    grade: 'middle',
    label: '中品',
    effectMultiplier: 1,
    toxicityMultiplier: 1,
    colorClass: 'text-tier-xuan',
  },
  high: {
    grade: 'high',
    label: '上品',
    effectMultiplier: 1.1,
    toxicityMultiplier: 0.65,
    colorClass: 'text-tier-tian',
  },
  perfect: {
    grade: 'perfect',
    label: '完美',
    effectMultiplier: 1.3,
    toxicityMultiplier: 0,
    colorClass: 'text-tier-shen',
  },
};
