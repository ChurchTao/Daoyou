import type { Quality } from '@/types/constants';

export const FATE_SLOT_COUNT = 3;
export const FATE_CANDIDATE_COUNT = 6;
export const FATE_REROLL_LIMIT = 5;

export const FATE_QUALITY_ORDER = [
  '凡品',
  '灵品',
  '玄品',
  '真品',
  '地品',
  '天品',
  '仙品',
  '神品',
] as const satisfies readonly Quality[];

export interface FateQualityTemplate {
  id: string;
  boonCount: number;
  burdenCount: number;
  rareCount: number;
  rareOptional?: boolean;
}

export const FATE_QUALITY_TEMPLATES: Record<Quality, FateQualityTemplate> = {
  凡品: { id: 'fan', boonCount: 1, burdenCount: 1, rareCount: 0 },
  灵品: { id: 'ling', boonCount: 2, burdenCount: 1, rareCount: 0 },
  玄品: {
    id: 'xuan',
    boonCount: 2,
    burdenCount: 1,
    rareCount: 1,
    rareOptional: true,
  },
  真品: { id: 'zhen', boonCount: 3, burdenCount: 1, rareCount: 0 },
  地品: { id: 'di', boonCount: 3, burdenCount: 1, rareCount: 1 },
  天品: { id: 'tian', boonCount: 3, burdenCount: 2, rareCount: 1 },
  仙品: { id: 'xian', boonCount: 4, burdenCount: 2, rareCount: 1 },
  神品: { id: 'shen', boonCount: 4, burdenCount: 3, rareCount: 2 },
};

export const FATE_CANDIDATE_QUALITY_SLOTS: Quality[][] = [
  ['凡品', '灵品'],
  ['灵品', '玄品', '真品'],
  ['玄品', '真品', '地品'],
  ['真品', '地品', '天品'],
  ['地品', '天品', '仙品'],
  ['天品', '仙品', '神品'],
];
