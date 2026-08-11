import type { ElementType, Quality } from '@shared/types/constants';

export const HERB_GARDEN_PLOT_COUNT = 6;
export const HERB_GARDEN_MAX_YIELD_BONUS = 0.25;
export const HERB_GARDEN_MAX_GROWTH_REDUCTION = 0.4;
export const HERB_GARDEN_MAX_STEAL_RATIO = 0.2;
export const HERB_GARDEN_MAX_HELPERS = 3;

export const HERB_SEED_QUALITY_VALUES = [
  '普通种',
  '良种',
  '灵种',
  '异种',
  '道种',
] as const;
export type HerbSeedQuality = (typeof HERB_SEED_QUALITY_VALUES)[number];

export interface HerbSeedQualityConfig {
  growthReduction: number;
  yieldBonus: number;
  mutationBonus: number;
  seedReturnBonus: number;
}

export const HERB_SEED_QUALITY_CONFIG: Record<
  HerbSeedQuality,
  HerbSeedQualityConfig
> = {
  普通种: { growthReduction: 0, yieldBonus: 0, mutationBonus: 0, seedReturnBonus: 0 },
  良种: { growthReduction: 0.03, yieldBonus: 0.03, mutationBonus: 0.001, seedReturnBonus: 0.03 },
  灵种: { growthReduction: 0.06, yieldBonus: 0.06, mutationBonus: 0.003, seedReturnBonus: 0.06 },
  异种: { growthReduction: 0.08, yieldBonus: 0.08, mutationBonus: 0.008, seedReturnBonus: 0.1 },
  道种: { growthReduction: 0.1, yieldBonus: 0.1, mutationBonus: 0.015, seedReturnBonus: 0.15 },
};

export interface HerbDefinition {
  key: string;
  name: string;
  rank: Quality;
  element: ElementType;
  growthMinutes: number;
  baseYield: number;
  mutationChance: number;
  seedReturnChance: number;
  minGardenLevel: number;
  description: string;
}

export const HERB_CATALOG: readonly HerbDefinition[] = [
  {
    key: 'qingling-grass',
    name: '青灵草',
    rank: '灵品',
    element: '木',
    growthMinutes: 45,
    baseYield: 8,
    mutationChance: 0.006,
    seedReturnChance: 0.5,
    minGardenLevel: 1,
    description: '常见木属灵植，药性温和，是入门丹方常用主材。',
  },
  {
    key: 'ninglu-flower',
    name: '凝露花',
    rank: '玄品',
    element: '水',
    growthMinutes: 120,
    baseYield: 7,
    mutationChance: 0.009,
    seedReturnChance: 0.35,
    minGardenLevel: 1,
    description: '晨露凝而不散，水属药性纯净，适合调和烈性药力。',
  },
  {
    key: 'chiyang-grass',
    name: '赤阳草',
    rank: '玄品',
    element: '火',
    growthMinutes: 240,
    baseYield: 7,
    mutationChance: 0.01,
    seedReturnChance: 0.32,
    minGardenLevel: 2,
    description: '喜阳喜火，叶脉赤红，常用于温养与火行丹方。',
  },
  {
    key: 'leiwen-vine',
    name: '雷纹藤',
    rank: '真品',
    element: '雷',
    growthMinutes: 480,
    baseYield: 5,
    mutationChance: 0.014,
    seedReturnChance: 0.22,
    minGardenLevel: 3,
    description: '藤上天生雷纹，药性躁烈，灵变时价值极高。',
  },
  {
    key: 'hanpo-lotus',
    name: '寒魄莲',
    rank: '真品',
    element: '冰',
    growthMinutes: 720,
    baseYield: 4,
    mutationChance: 0.016,
    seedReturnChance: 0.18,
    minGardenLevel: 4,
    description: '寒气凝魄而生，对药圃灵气与培育手段要求较高。',
  },
] as const;

export const HERB_GARDEN_STARTER_SEEDS = [
  { herbKey: 'qingling-grass', seedQuality: '普通种' as const, quantity: 6 },
  { herbKey: 'ninglu-flower', seedQuality: '普通种' as const, quantity: 3 },
  { herbKey: 'chiyang-grass', seedQuality: '普通种' as const, quantity: 2 },
] as const;

export const HERB_GARDEN_QUALITY_ORDER: readonly Quality[] = [
  '凡品',
  '灵品',
  '玄品',
  '真品',
  '地品',
  '天品',
  '仙品',
  '神品',
];

export function findHerbDefinition(key: string): HerbDefinition | undefined {
  return HERB_CATALOG.find((herb) => herb.key === key);
}

export function nextHerbQuality(quality: Quality): Quality {
  const index = HERB_GARDEN_QUALITY_ORDER.indexOf(quality);
  if (index < 0 || index >= HERB_GARDEN_QUALITY_ORDER.length - 1) return quality;
  return HERB_GARDEN_QUALITY_ORDER[index + 1]!;
}

export function isHerbSeedQuality(value: unknown): value is HerbSeedQuality {
  return HERB_SEED_QUALITY_VALUES.includes(value as HerbSeedQuality);
}

export interface HerbGardenSeedMeta {
  kind: 'herb_seed';
  herbKey: string;
  seedQuality: HerbSeedQuality;
}

export interface HerbGardenSeedStack {
  materialId: string;
  name: string;
  herbKey: string;
  herbName: string;
  herbRank: Quality;
  element: ElementType;
  seedQuality: HerbSeedQuality;
  quantity: number;
  minGardenLevel: number;
}

export type HerbGardenPlotStatus = 'empty' | 'growing' | 'ready';

export interface HerbGardenModifierLine {
  source: 'seed' | 'fate' | 'root' | 'sect' | 'help';
  label: string;
  detail: string;
}

export interface HerbGardenPlotView {
  slot: number;
  plotId?: string;
  status: HerbGardenPlotStatus;
  herbKey?: string;
  herbName?: string;
  herbRank?: Quality;
  element?: ElementType;
  seedQuality?: HerbSeedQuality;
  plantedAt?: string;
  readyAt?: string;
  baseYield?: number;
  remainingYield?: number;
  stealLimit?: number;
  stolenCount?: number;
  mutationChance?: number;
  mutationRank?: Quality | null;
  seedReturnChance?: number;
  modifiers?: HerbGardenModifierLine[];
  helperCount?: number;
  canHelp?: boolean;
  canSteal?: boolean;
  alreadyHelped?: boolean;
  alreadyStolen?: boolean;
}

export interface HerbGardenLogView {
  id: string;
  action: 'plant' | 'harvest' | 'help' | 'steal';
  actorId: string;
  actorName: string;
  ownerId: string;
  herbName: string;
  message: string;
  createdAt: string;
}

export interface HerbGardenFriendView {
  cultivatorId: string;
  name: string;
  realm: string;
  readyPlots: number;
  growingPlots: number;
  canVisit: boolean;
}

export interface HerbGardenState {
  owner: { cultivatorId: string; name: string; isSelf: boolean };
  gardenLevel: number;
  plots: HerbGardenPlotView[];
  seeds: HerbGardenSeedStack[];
  logs: HerbGardenLogView[];
  friends: HerbGardenFriendView[];
  summary: {
    planted: number;
    ready: number;
    averageMutationChance: number;
    totalHarvests: number;
  };
}

export interface HerbGardenHarvestResult {
  herbName: string;
  rank: Quality;
  quantity: number;
  mutation?: { name: string; rank: Quality; quantity: 1 };
  returnedSeed?: { name: string; seedQuality: HerbSeedQuality; quantity: 1 };
}
