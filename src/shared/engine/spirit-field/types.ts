import type { ElementType, Quality, RealmType } from '@shared/types/constants';

export const SPIRIT_FIELD_CARE_ACTIONS = [
  'dry_soil',
  'moisten',
  'wood_nurture',
  'loosen_soil',
  'fertilize',
  'observe',
  'wait',
] as const;
export type SpiritFieldCareAction = (typeof SPIRIT_FIELD_CARE_ACTIONS)[number];

export const SPIRIT_FIELD_CARE_NEEDS = [
  'moisture_high',
  'moisture_low',
  'qi_stagnant',
  'weak_growth',
] as const;
export type SpiritFieldCareNeed = (typeof SPIRIT_FIELD_CARE_NEEDS)[number];

export type SpiritFieldHarvestMode = 'focused' | 'broad';

/** 灵植形态：稳定 ID 存入种子快照，前端再映射中文。 */
export const SPIRIT_SEED_GROWTH_FORMS = [
  'herb',
  'flower',
  'vine',
  'shrub',
  'tree',
  'fungus',
  'aquatic',
  'root',
] as const;
export type SpiritSeedGrowthForm = (typeof SPIRIT_SEED_GROWTH_FORMS)[number];

/** 成熟后主要采收部位。 */
export const SPIRIT_SEED_HARVEST_PARTS = [
  'leaf',
  'flower',
  'fruit',
  'root',
  'rhizome',
  'whole',
  'spore',
  'seedpod',
] as const;
export type SpiritSeedHarvestPart = (typeof SPIRIT_SEED_HARVEST_PARTS)[number];

/** 生态标签：目前主要用于描述、观察和后续玩法扩展，不直接决定奖励。 */
export const SPIRIT_SEED_HABITAT_TAGS = [
  'mountain',
  'valley',
  'forest',
  'cave',
  'wetland',
  'waterside',
  'rocky',
  'volcanic',
  'cold',
  'warm',
  'shaded',
  'sunny',
] as const;
export type SpiritSeedHabitatTag = (typeof SPIRIT_SEED_HABITAT_TAGS)[number];

/**
 * 养护习性标签。
 * AI 只能从受限枚举中选择；服务器只允许它们对“异常倾向”产生轻量权重，
 * 不得直接决定产量、品质、升品率等经济结果。
 */
export const SPIRIT_SEED_CARE_STYLE_TAGS = [
  'moisture-loving',
  'drought-tolerant',
  'water-sensitive',
  'qi-sensitive',
  'fertile-soil',
  'loose-soil',
  'shade-loving',
  'sun-loving',
] as const;
export type SpiritSeedCareStyleTag =
  (typeof SPIRIT_SEED_CARE_STYLE_TAGS)[number];

/** 灵植用途语义标签；为炼丹/任务/图鉴等后续系统预留。 */
export const SPIRIT_SEED_USE_TAGS = [
  'alchemy',
  'healing',
  'qi-restoration',
  'spirit-nourishing',
  'body-tempering',
  'detox',
  'meridian',
  'formation',
] as const;
export type SpiritSeedUseTag = (typeof SPIRIT_SEED_USE_TAGS)[number];

/**
 * 专用灵种生成器的“硬约束骨架”。
 * 注意：它不再复用 MaterialSkeleton；种子领域只共享 Quality/Element 等基础常量。
 */
export interface SpiritSeedSkeleton {
  rank: Quality;
  quantity: number;
  forcedElement?: ElementType;
  /** 市场区域等上下文，仅供 AI 塑造地域风格，不能改变数值。 */
  regionTags?: string[];
}

export interface SpiritSeedRandomOptions {
  guaranteedRank?: Quality;
  specifiedElement?: ElementType;
  regionTags?: string[];
  qualityChanceMap?: Record<Quality, number>;
  rankRange?: { min: Quality; max: Quality };
}

/** AI 负责的灵植身份层。所有标签均受 schema 约束。 */
export interface SpiritSeedIdentity {
  plantName: string;
  seedName: string;
  description: string;
  seedDescription: string;
  appearance: string;
  matureSign: string;
  element: ElementType;
  growthForm: SpiritSeedGrowthForm;
  harvestPart: SpiritSeedHarvestPart;
  habitatTags: SpiritSeedHabitatTag[];
  careStyleTags: SpiritSeedCareStyleTag[];
  useTags: SpiritSeedUseTag[];
}

/**
 * 种子生成时固化的作物快照。
 * - identity/tags 来自 SpiritSeedGenerator 专用 Prompt，并经过严格枚举校验；
 * - 生长时间、产量、养护次数等数值只来自服务器品质平衡配置；
 * - 播种后整份快照写入田块，避免后续生成器/平衡改动让在田作物“变种”。
 */
export interface SpiritFieldPlantSnapshot {
  id: string;
  name: string;
  seedName: string;
  quality: Quality;
  element: ElementType;
  minRealm: RealmType;
  baseGrowthMs: number;
  careSlots: number;
  careCooldownMs: number;
  description: string;
  seedDescription: string;
  appearance: string;
  matureSign: string;
  growthForm: SpiritSeedGrowthForm;
  harvestPart: SpiritSeedHarvestPart;
  habitatTags: SpiritSeedHabitatTag[];
  careStyleTags: SpiritSeedCareStyleTag[];
  useTags: SpiritSeedUseTag[];
  baseYieldMin: number;
  baseYieldMax: number;
}

export interface SpiritFieldSeedSpecV2 {
  version: 2;
  plant: SpiritFieldPlantSnapshot;
}

export interface SpiritFieldPlotState {
  index: number;
  /** 保留给前端/日志做稳定引用；真实规则以 plant 快照为准。 */
  plantId: string | null;
  plant: SpiritFieldPlantSnapshot | null;
  plantedAt: string | null;
  careCount: number;
  careBoostMs: number;
  careScoreTotal: number;
  careScoreCount: number;
  lastCareAt: string | null;
  careNeed: SpiritFieldCareNeed | null;
}

export interface SpiritFieldCarePlan {
  action: SpiritFieldCareAction;
  element?: ElementType;
  intensity: 'light' | 'moderate';
  target: 'soil' | 'root' | 'leaf' | 'whole';
  summary: string;
  reason: string;
  risk: string;
  qiCost: number;
}

export interface SpiritFieldObservation {
  topic: 'leaf' | 'soil' | 'aura';
  label: string;
  text: string;
  suggestedAction: string;
}

export type SpiritFieldCareGrade = 'excellent' | 'good' | 'poor' | 'neutral';
