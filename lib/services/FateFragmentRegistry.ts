import { CreationTags } from '@/engine/shared/tag-domain';
import type {
  ElementType,
  Quality,
} from '@/types/constants';
import { QUALITY_ORDER } from '@/types/constants';
import type {
  FateEffectEntry,
  FateEffectExtreme,
  FateEffectPolarity,
  FateEffectScope,
  FateEffectType,
} from '@/types/cultivator';

export type FateRollStrategy = 'fully_random' | 'root_restricted';
export type FateScopePattern = 'single_focus' | 'dual_focus';

export interface FateRootRequirement {
  anyOf: ElementType[];
}

interface FateFragmentBase {
  id: string;
  label: string;
  tags: string[];
  keywords?: string[];
  weight: number;
  exclusiveGroup?: string;
  minQuality?: Quality;
  maxQuality?: Quality;
}

export interface FateCoreFragmentDefinition extends FateFragmentBase {
  kind: 'core';
  scopePattern: FateScopePattern;
  primaryScopes: FateEffectScope[];
  secondaryScopes: FateEffectScope[];
  requiredRoots?: FateRootRequirement;
  forbiddenRoots?: ElementType[];
  localNameRoot: string;
  localSuffix: string;
  localDescription: string;
}

export interface FateEffectFragmentDefinition extends FateFragmentBase {
  kind: 'boon' | 'burden' | 'rare';
  scope: FateEffectScope;
  effectType: FateEffectType;
  rewardTypes?: string[];
  hintLabel?: string;
  values: Record<Quality, number>;
  extremes?: Partial<Record<Quality, FateEffectExtreme>>;
}

const QUALITY_LADDER: Quality[] = [
  '凡品',
  '灵品',
  '玄品',
  '真品',
  '地品',
  '天品',
  '仙品',
  '神品',
];

const TAG_LABELS: Record<string, string> = {
  [CreationTags.MATERIAL.SEMANTIC_BLADE]: '锋刃',
  [CreationTags.MATERIAL.SEMANTIC_METAL]: '金铁',
  [CreationTags.MATERIAL.SEMANTIC_ALCHEMY]: '丹道',
  [CreationTags.MATERIAL.SEMANTIC_WOOD]: '草木',
  [CreationTags.MATERIAL.SEMANTIC_SUSTAIN]: '疗养',
  [CreationTags.MATERIAL.SEMANTIC_THUNDER]: '雷霆',
  [CreationTags.MATERIAL.SEMANTIC_BURST]: '爆发',
  [CreationTags.MATERIAL.SEMANTIC_GUARD]: '守御',
  [CreationTags.MATERIAL.SEMANTIC_EARTH]: '厚土',
  [CreationTags.MATERIAL.SEMANTIC_SPIRIT]: '神识',
  [CreationTags.MATERIAL.SEMANTIC_MANUAL]: '典籍',
  [CreationTags.MATERIAL.SEMANTIC_SPACE]: '界隙',
  [CreationTags.MATERIAL.SEMANTIC_WATER]: '流波',
  [CreationTags.MATERIAL.SEMANTIC_TIME]: '岁序',
  [CreationTags.MATERIAL.SEMANTIC_QI]: '灵气',
  [CreationTags.MATERIAL.SEMANTIC_BLOOD]: '血煞',
  [CreationTags.MATERIAL.SEMANTIC_BEAST]: '妖性',
  [CreationTags.MATERIAL.SEMANTIC_WIND]: '流岚',
  [CreationTags.MATERIAL.SEMANTIC_ILLUSION]: '幻术',
};

const REWARD_TYPE_LABELS: Record<string, string> = {
  gongfa_manual: '功法',
  skill_manual: '神通',
  herb: '药材',
  consumable: '丹药',
  ore: '矿材',
  aux: '辅材',
  monster: '妖兽',
  tcdb: '天材地宝',
};

function byQuality(
  fan: number,
  ling: number,
  xuan: number,
  zhen: number,
  di: number,
  tian: number,
  xian: number,
  shen: number,
): Record<Quality, number> {
  return {
    凡品: fan,
    灵品: ling,
    玄品: xuan,
    真品: zhen,
    地品: di,
    天品: tian,
    仙品: xian,
    神品: shen,
  };
}

function defineCore(
  definition: FateCoreFragmentDefinition,
): FateCoreFragmentDefinition {
  return definition;
}

function defineEffect(
  definition: FateEffectFragmentDefinition,
): FateEffectFragmentDefinition {
  return definition;
}

export function formatFateTagLabel(tag: string): string {
  return TAG_LABELS[tag] ?? tag.split('.').pop() ?? tag;
}

function formatTagGroup(tags: string[] | undefined): string {
  if (!tags?.length) return '未知';
  return tags.map((tag) => formatFateTagLabel(tag)).join(' / ');
}

function formatRewardTypeGroup(rewardTypes: string[] | undefined): string {
  if (!rewardTypes?.length) return '机缘';
  return rewardTypes.map((type) => REWARD_TYPE_LABELS[type] ?? type).join(' / ');
}

function formatPercentDelta(delta: number): string {
  const value = Math.round(delta * 100);
  return `${value >= 0 ? '+' : ''}${value}%`;
}

function formatExtreme(extreme: FateEffectExtreme): string {
  switch (extreme) {
    case 'extreme':
      return '极';
    case 'strong':
      return '强';
    default:
      return '微';
  }
}

function defaultExtreme(
  fragment: FateEffectFragmentDefinition,
  quality: Quality,
): FateEffectExtreme {
  if (fragment.extremes?.[quality]) {
    return fragment.extremes[quality]!;
  }
  if (fragment.kind === 'rare') {
    return QUALITY_ORDER[quality] >= QUALITY_ORDER['天品']
      ? 'extreme'
      : 'strong';
  }
  return QUALITY_ORDER[quality] >= QUALITY_ORDER['天品']
    ? 'extreme'
    : QUALITY_ORDER[quality] >= QUALITY_ORDER['玄品']
      ? 'strong'
      : 'mild';
}

export function buildFateEffectEntry(
  fragment: FateEffectFragmentDefinition,
  quality: Quality,
  index: number,
): FateEffectEntry {
  const value = fragment.values[quality];
  const polarity: FateEffectPolarity =
    fragment.kind === 'burden' ? 'burden' : 'boon';
  const extreme = defaultExtreme(fragment, quality);
  const intensity = formatExtreme(extreme);
  let label = fragment.label;
  let description = fragment.label;

  switch (fragment.effectType) {
    case 'creation_tag_bias': {
      const tagText = formatTagGroup(fragment.tags);
      label =
        polarity === 'boon'
          ? `造物更易引出【${tagText}】词缀（${intensity}）`
          : `造物更难圆融【${tagText}】词缀（${intensity}）`;
      description = label;
      break;
    }
    case 'cultivation_exp_multiplier': {
      label = `闭关修为获取 ${formatPercentDelta(value - 1)}`;
      description =
        polarity === 'boon'
          ? `命格催动根骨运转，令闭关修为获取 ${formatPercentDelta(value - 1)}。`
          : `命格牵扯修炼节奏，令闭关修为获取 ${formatPercentDelta(value - 1)}。`;
      break;
    }
    case 'insight_gain_multiplier': {
      label = `闭关感悟获取 ${formatPercentDelta(value - 1)}`;
      description =
        polarity === 'boon'
          ? `命格偏于悟理，令闭关感悟获取 ${formatPercentDelta(value - 1)}。`
          : `命格扰乱心念，令闭关感悟获取 ${formatPercentDelta(value - 1)}。`;
      break;
    }
    case 'breakthrough_bonus': {
      label = `突破成功率 ${formatPercentDelta(value)}`;
      description =
        polarity === 'boon'
          ? `命格牵动临门一脚，令突破成功率 ${formatPercentDelta(value)}。`
          : `命格反噬冲关心气，令突破成功率 ${formatPercentDelta(value)}。`;
      break;
    }
    case 'reward_type_bias': {
      const rewardText = formatRewardTypeGroup(fragment.rewardTypes);
      label = `${rewardText}类机缘权重 ${formatPercentDelta(value - 1)}`;
      description =
        polarity === 'boon'
          ? `命格更易感召${rewardText}类机缘，权重 ${formatPercentDelta(value - 1)}。`
          : `命格常令${rewardText}类机缘与你错身而过，权重 ${formatPercentDelta(value - 1)}。`;
      break;
    }
    case 'reward_score_multiplier': {
      label = `整体机缘品质 ${formatPercentDelta(value - 1)}`;
      description =
        polarity === 'boon'
          ? `命格偏向厚赐，令整体机缘品质 ${formatPercentDelta(value - 1)}。`
          : `命格牵出歧路，令整体机缘品质 ${formatPercentDelta(value - 1)}。`;
      break;
    }
    case 'encounter_hint': {
      const hintLabel = fragment.hintLabel ?? fragment.label;
      label = `更易牵动「${hintLabel}」机缘`;
      description = `这道命格常会把你引向「${hintLabel}」一类的天机暗线。`;
      break;
    }
  }

  return {
    id: `${fragment.id}:${quality}:${index}`,
    fragmentId: fragment.id,
    scope: fragment.scope,
    polarity,
    effectType: fragment.effectType,
    value,
    tags: fragment.tags,
    rewardTypes: fragment.rewardTypes,
    label,
    description,
    extreme,
  };
}

export function isQualityAllowed(
  definition: FateFragmentBase,
  quality: Quality,
): boolean {
  const order = QUALITY_ORDER[quality];
  if (
    definition.minQuality &&
    order < QUALITY_ORDER[definition.minQuality]
  ) {
    return false;
  }
  if (
    definition.maxQuality &&
    order > QUALITY_ORDER[definition.maxQuality]
  ) {
    return false;
  }
  return true;
}

const FATE_CORE_FRAGMENTS = [
  defineCore({
    id: 'core_sword_bone',
    kind: 'core',
    label: '锋芒入骨',
    tags: [
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_METAL,
    ],
    keywords: ['剑', '剑修', '锋', '斩', '金'],
    weight: 1,
    scopePattern: 'single_focus',
    primaryScopes: ['creation'],
    secondaryScopes: ['breakthrough', 'world'],
    requiredRoots: { anyOf: ['金'] },
    localNameRoot: '剑锋',
    localSuffix: '命',
    localDescription: '锋芒先入骨，凡涉金铁与攻伐之势，皆更易顺手成形。',
  }),
  defineCore({
    id: 'core_verdant_danheart',
    kind: 'core',
    label: '药性天成',
    tags: [
      CreationTags.MATERIAL.SEMANTIC_ALCHEMY,
      CreationTags.MATERIAL.SEMANTIC_WOOD,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
    ],
    keywords: ['丹', '药', '医', '草木', '疗'],
    weight: 1,
    scopePattern: 'dual_focus',
    primaryScopes: ['creation', 'world'],
    secondaryScopes: ['cultivation'],
    requiredRoots: { anyOf: ['木'] },
    localNameRoot: '丹心',
    localSuffix: '骨',
    localDescription: '药性与草木之机天然相合，常能顺势引来丹药与灵植机缘。',
  }),
  defineCore({
    id: 'core_thunder_vein',
    kind: 'core',
    label: '雷机贯体',
    tags: [
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ],
    keywords: ['雷', '霆', '迅', '电'],
    weight: 1,
    scopePattern: 'dual_focus',
    primaryScopes: ['creation', 'breakthrough'],
    secondaryScopes: ['cultivation'],
    requiredRoots: { anyOf: ['雷'] },
    localNameRoot: '雷殛',
    localSuffix: '脉',
    localDescription: '雷机先天躁烈，最擅催生爆发与破关一瞬的锋利决断。',
  }),
  defineCore({
    id: 'core_flowing_bone',
    kind: 'core',
    label: '流波绵长',
    tags: [
      CreationTags.MATERIAL.SEMANTIC_WATER,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
    ],
    keywords: ['水', '潮', '波', '流', '养'],
    weight: 1,
    scopePattern: 'dual_focus',
    primaryScopes: ['cultivation', 'world'],
    secondaryScopes: ['creation'],
    requiredRoots: { anyOf: ['水'] },
    localNameRoot: '流波',
    localSuffix: '骨',
    localDescription: '绵长水势最善温养，回气调息与久修之道更易得其门径。',
  }),
  defineCore({
    id: 'core_mountain_frame',
    kind: 'core',
    label: '厚土载岳',
    tags: [
      CreationTags.MATERIAL.SEMANTIC_EARTH,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
    ],
    keywords: ['土', '山', '岳', '稳', '守'],
    weight: 1,
    scopePattern: 'single_focus',
    primaryScopes: ['cultivation'],
    secondaryScopes: ['creation', 'breakthrough'],
    requiredRoots: { anyOf: ['土'] },
    localNameRoot: '镇岳',
    localSuffix: '体',
    localDescription: '根骨如岳，最擅走持久、守成与厚积薄发的一路。',
  }),
  defineCore({
    id: 'core_void_platform',
    kind: 'core',
    label: '空明灵台',
    tags: [
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_SPACE,
    ],
    keywords: ['悟', '经', '神识', '推演', '空明'],
    weight: 1,
    scopePattern: 'dual_focus',
    primaryScopes: ['cultivation', 'world'],
    secondaryScopes: ['creation'],
    localNameRoot: '空明',
    localSuffix: '台',
    localDescription: '神识清明，最易在悟理、典籍与界隙残痕中见到旁人看不见的暗线。',
  }),
  defineCore({
    id: 'core_time_fruit',
    kind: 'core',
    label: '岁机在身',
    tags: [
      CreationTags.MATERIAL.SEMANTIC_TIME,
      CreationTags.MATERIAL.SEMANTIC_QI,
    ],
    keywords: ['岁', '时', '机缘', '契机', '命数'],
    weight: 1,
    scopePattern: 'dual_focus',
    primaryScopes: ['world', 'breakthrough'],
    secondaryScopes: ['cultivation'],
    localNameRoot: '蚀岁',
    localSuffix: '胎',
    localDescription: '与岁序同频，常在机缘流转与境关松动时先一步闻得风声。',
  }),
  defineCore({
    id: 'core_blood_hunt',
    kind: 'core',
    label: '血煞逐命',
    tags: [
      CreationTags.MATERIAL.SEMANTIC_BLOOD,
      CreationTags.MATERIAL.SEMANTIC_BEAST,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ],
    keywords: ['血', '兽', '猎', '煞', '杀'],
    weight: 1,
    scopePattern: 'dual_focus',
    primaryScopes: ['world', 'breakthrough'],
    secondaryScopes: ['creation'],
    localNameRoot: '血狩',
    localSuffix: '骨',
    localDescription: '血煞与兽性共鸣，更容易卷入猎杀、争夺与险关强冲之局。',
  }),
  defineCore({
    id: 'core_wind_mist',
    kind: 'core',
    label: '流岚藏形',
    tags: [
      CreationTags.MATERIAL.SEMANTIC_WIND,
      CreationTags.MATERIAL.SEMANTIC_ILLUSION,
    ],
    keywords: ['风', '岚', '幻', '轻灵', '变'],
    weight: 0.9,
    scopePattern: 'dual_focus',
    primaryScopes: ['creation', 'world'],
    secondaryScopes: ['cultivation'],
    requiredRoots: { anyOf: ['风'] },
    localNameRoot: '流岚',
    localSuffix: '眸',
    localDescription: '身与风幻同调，最容易牵出变化、轻灵与迷神相关的旁门机缘。',
  }),
  defineCore({
    id: 'core_origin_foundation',
    kind: 'core',
    label: '归元守本',
    tags: [
      CreationTags.MATERIAL.SEMANTIC_QI,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
    ],
    keywords: ['归元', '守本', '道基', '平稳', '根本'],
    weight: 0.9,
    scopePattern: 'dual_focus',
    primaryScopes: ['cultivation', 'creation'],
    secondaryScopes: ['world'],
    localNameRoot: '归元',
    localSuffix: '骨',
    localDescription: '善守本真，走的是道基稳固、慢磨成器的长线一路。',
  }),
] as const satisfies readonly FateCoreFragmentDefinition[];

const FATE_BOON_FRAGMENTS = [
  defineEffect({
    id: 'boon_blade_resonance',
    kind: 'boon',
    scope: 'creation',
    effectType: 'creation_tag_bias',
    label: '锋刃词缀更易成形',
    tags: [
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_METAL,
    ],
    keywords: ['剑', '锋', '斩', '金'],
    weight: 1,
    values: byQuality(0.28, 0.36, 0.46, 0.58, 0.72, 0.9, 1.08, 1.24),
  }),
  defineEffect({
    id: 'boon_alchemy_resonance',
    kind: 'boon',
    scope: 'creation',
    effectType: 'creation_tag_bias',
    label: '丹道词缀更易成形',
    tags: [
      CreationTags.MATERIAL.SEMANTIC_ALCHEMY,
      CreationTags.MATERIAL.SEMANTIC_WOOD,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
    ],
    keywords: ['丹', '药', '医', '养'],
    weight: 1,
    values: byQuality(0.26, 0.34, 0.44, 0.56, 0.7, 0.88, 1.04, 1.2),
  }),
  defineEffect({
    id: 'boon_thunder_resonance',
    kind: 'boon',
    scope: 'creation',
    effectType: 'creation_tag_bias',
    label: '雷霆词缀更易成形',
    tags: [
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ],
    keywords: ['雷', '霆', '迅', '爆'],
    weight: 1,
    values: byQuality(0.3, 0.38, 0.48, 0.62, 0.78, 0.96, 1.16, 1.35),
  }),
  defineEffect({
    id: 'boon_guard_resonance',
    kind: 'boon',
    scope: 'creation',
    effectType: 'creation_tag_bias',
    label: '守御词缀更易成形',
    tags: [
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_EARTH,
    ],
    keywords: ['守', '土', '稳', '山'],
    weight: 1,
    values: byQuality(0.24, 0.32, 0.42, 0.54, 0.68, 0.86, 1.02, 1.18),
  }),
  defineEffect({
    id: 'boon_spirit_resonance',
    kind: 'boon',
    scope: 'creation',
    effectType: 'creation_tag_bias',
    label: '悟理词缀更易成形',
    tags: [
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_SPACE,
    ],
    keywords: ['悟', '经', '神识', '界隙'],
    weight: 1,
    values: byQuality(0.22, 0.3, 0.4, 0.52, 0.66, 0.82, 0.98, 1.14),
  }),
  defineEffect({
    id: 'boon_cultivation_rooted',
    kind: 'boon',
    scope: 'cultivation',
    effectType: 'cultivation_exp_multiplier',
    label: '闭关修为更稳',
    tags: [CreationTags.MATERIAL.SEMANTIC_QI],
    keywords: ['修炼', '稳', '道基'],
    weight: 0.95,
    values: byQuality(1.03, 1.05, 1.08, 1.1, 1.13, 1.16, 1.19, 1.23),
  }),
  defineEffect({
    id: 'boon_insight_clarity',
    kind: 'boon',
    scope: 'cultivation',
    effectType: 'insight_gain_multiplier',
    label: '闭关感悟更盛',
    tags: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
    keywords: ['悟', '经', '神识'],
    weight: 0.95,
    values: byQuality(1.04, 1.06, 1.1, 1.13, 1.16, 1.2, 1.24, 1.28),
  }),
  defineEffect({
    id: 'boon_breakthrough_drive',
    kind: 'boon',
    scope: 'breakthrough',
    effectType: 'breakthrough_bonus',
    label: '冲关心气更足',
    tags: [CreationTags.MATERIAL.SEMANTIC_BURST],
    keywords: ['破关', '雷', '血', '险'],
    weight: 0.95,
    values: byQuality(0.01, 0.015, 0.022, 0.03, 0.038, 0.048, 0.058, 0.07),
  }),
  defineEffect({
    id: 'boon_world_manual',
    kind: 'boon',
    scope: 'world',
    effectType: 'reward_type_bias',
    label: '典籍类机缘更易牵引',
    tags: [CreationTags.MATERIAL.SEMANTIC_MANUAL],
    keywords: ['经', '录', '典籍', '传承'],
    rewardTypes: ['gongfa_manual', 'skill_manual'],
    weight: 0.95,
    values: byQuality(1.08, 1.1, 1.14, 1.18, 1.22, 1.27, 1.32, 1.38),
  }),
  defineEffect({
    id: 'boon_world_herb',
    kind: 'boon',
    scope: 'world',
    effectType: 'reward_type_bias',
    label: '药材类机缘更易牵引',
    tags: [CreationTags.MATERIAL.SEMANTIC_ALCHEMY],
    keywords: ['药', '丹', '草木'],
    rewardTypes: ['herb', 'consumable'],
    weight: 0.95,
    values: byQuality(1.08, 1.1, 1.14, 1.18, 1.22, 1.27, 1.32, 1.38),
  }),
  defineEffect({
    id: 'boon_world_ore',
    kind: 'boon',
    scope: 'world',
    effectType: 'reward_type_bias',
    label: '矿材类机缘更易牵引',
    tags: [CreationTags.MATERIAL.SEMANTIC_METAL],
    keywords: ['矿', '金铁', '铸炼'],
    rewardTypes: ['ore', 'aux'],
    weight: 0.95,
    values: byQuality(1.08, 1.1, 1.14, 1.18, 1.22, 1.27, 1.32, 1.38),
  }),
  defineEffect({
    id: 'boon_world_monster',
    kind: 'boon',
    scope: 'world',
    effectType: 'reward_type_bias',
    label: '妖兽类机缘更易牵引',
    tags: [CreationTags.MATERIAL.SEMANTIC_BEAST],
    keywords: ['兽', '血', '猎杀'],
    rewardTypes: ['monster', 'consumable'],
    weight: 0.9,
    values: byQuality(1.08, 1.1, 1.14, 1.18, 1.22, 1.27, 1.32, 1.38),
  }),
  defineEffect({
    id: 'boon_world_quality',
    kind: 'boon',
    scope: 'world',
    effectType: 'reward_score_multiplier',
    label: '整体机缘更丰',
    tags: [CreationTags.MATERIAL.SEMANTIC_QI],
    keywords: ['机缘', '命数', '气运'],
    weight: 0.8,
    values: byQuality(1.03, 1.04, 1.06, 1.08, 1.1, 1.13, 1.16, 1.2),
  }),
  defineEffect({
    id: 'boon_encounter_sword',
    kind: 'boon',
    scope: 'world',
    effectType: 'encounter_hint',
    label: '剑冢残痕',
    hintLabel: '剑冢残痕',
    tags: [CreationTags.MATERIAL.SEMANTIC_BLADE],
    keywords: ['剑', '锋', '残痕'],
    weight: 0.7,
    values: byQuality(1, 1, 1, 1, 1, 1, 1, 1),
  }),
  defineEffect({
    id: 'boon_encounter_herb',
    kind: 'boon',
    scope: 'world',
    effectType: 'encounter_hint',
    label: '古药圃',
    hintLabel: '古药圃',
    tags: [CreationTags.MATERIAL.SEMANTIC_ALCHEMY],
    keywords: ['药', '圃', '灵植'],
    weight: 0.7,
    values: byQuality(1, 1, 1, 1, 1, 1, 1, 1),
  }),
  defineEffect({
    id: 'boon_encounter_thunder',
    kind: 'boon',
    scope: 'world',
    effectType: 'encounter_hint',
    label: '天劫旧场',
    hintLabel: '天劫旧场',
    tags: [CreationTags.MATERIAL.SEMANTIC_THUNDER],
    keywords: ['雷', '劫', '旧场'],
    weight: 0.7,
    values: byQuality(1, 1, 1, 1, 1, 1, 1, 1),
  }),
  defineEffect({
    id: 'boon_encounter_void',
    kind: 'boon',
    scope: 'world',
    effectType: 'encounter_hint',
    label: '藏经暗阁',
    hintLabel: '藏经暗阁',
    tags: [CreationTags.MATERIAL.SEMANTIC_MANUAL],
    keywords: ['经', '阁', '暗门'],
    weight: 0.7,
    values: byQuality(1, 1, 1, 1, 1, 1, 1, 1),
  }),
] as const satisfies readonly FateEffectFragmentDefinition[];

const FATE_BURDEN_FRAGMENTS = [
  defineEffect({
    id: 'burden_avoid_sustain',
    kind: 'burden',
    scope: 'creation',
    effectType: 'creation_tag_bias',
    label: '疗养词缀更难圆融',
    tags: [
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.SEMANTIC_ALCHEMY,
    ],
    keywords: ['疗', '丹', '养'],
    weight: 1,
    values: byQuality(0.22, 0.3, 0.38, 0.5, 0.66, 0.84, 1.02, 1.2),
  }),
  defineEffect({
    id: 'burden_avoid_blade',
    kind: 'burden',
    scope: 'creation',
    effectType: 'creation_tag_bias',
    label: '锋刃词缀更难圆融',
    tags: [
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_METAL,
    ],
    keywords: ['剑', '锋', '斩', '金'],
    weight: 1,
    values: byQuality(0.22, 0.3, 0.38, 0.5, 0.66, 0.84, 1.02, 1.2),
  }),
  defineEffect({
    id: 'burden_avoid_burst',
    kind: 'burden',
    scope: 'creation',
    effectType: 'creation_tag_bias',
    label: '爆发词缀更难圆融',
    tags: [
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
    ],
    keywords: ['爆', '雷', '霆'],
    weight: 1,
    values: byQuality(0.22, 0.3, 0.38, 0.5, 0.66, 0.84, 1.02, 1.2),
  }),
  defineEffect({
    id: 'burden_avoid_illusion',
    kind: 'burden',
    scope: 'creation',
    effectType: 'creation_tag_bias',
    label: '幻变词缀更难圆融',
    tags: [
      CreationTags.MATERIAL.SEMANTIC_ILLUSION,
      CreationTags.MATERIAL.SEMANTIC_WIND,
    ],
    keywords: ['幻', '风', '变'],
    weight: 0.95,
    values: byQuality(0.2, 0.28, 0.36, 0.48, 0.62, 0.8, 0.98, 1.16),
  }),
  defineEffect({
    id: 'burden_cultivation_drag',
    kind: 'burden',
    scope: 'cultivation',
    effectType: 'cultivation_exp_multiplier',
    label: '闭关修为转得更慢',
    tags: [CreationTags.MATERIAL.SEMANTIC_QI],
    keywords: ['慢', '拖', '滞'],
    weight: 0.95,
    values: byQuality(0.98, 0.96, 0.93, 0.9, 0.87, 0.83, 0.79, 0.74),
  }),
  defineEffect({
    id: 'burden_insight_drift',
    kind: 'burden',
    scope: 'cultivation',
    effectType: 'insight_gain_multiplier',
    label: '闭关感悟更易飘散',
    tags: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
    keywords: ['乱', '浮', '散'],
    weight: 0.95,
    values: byQuality(0.97, 0.95, 0.92, 0.88, 0.84, 0.8, 0.75, 0.7),
  }),
  defineEffect({
    id: 'burden_breakthrough_stumble',
    kind: 'burden',
    scope: 'breakthrough',
    effectType: 'breakthrough_bonus',
    label: '突破时更易失衡',
    tags: [CreationTags.MATERIAL.SEMANTIC_GUARD],
    keywords: ['失衡', '反噬', '走偏'],
    weight: 0.95,
    values: byQuality(-0.01, -0.015, -0.022, -0.03, -0.038, -0.05, -0.062, -0.075),
  }),
  defineEffect({
    id: 'burden_world_manual',
    kind: 'burden',
    scope: 'world',
    effectType: 'reward_type_bias',
    label: '典籍机缘更易擦肩',
    tags: [CreationTags.MATERIAL.SEMANTIC_MANUAL],
    keywords: ['经', '录', '典籍'],
    rewardTypes: ['gongfa_manual', 'skill_manual'],
    weight: 0.95,
    values: byQuality(0.96, 0.93, 0.89, 0.84, 0.79, 0.74, 0.68, 0.62),
  }),
  defineEffect({
    id: 'burden_world_herb',
    kind: 'burden',
    scope: 'world',
    effectType: 'reward_type_bias',
    label: '药材机缘更易擦肩',
    tags: [CreationTags.MATERIAL.SEMANTIC_ALCHEMY],
    keywords: ['药', '丹', '草木'],
    rewardTypes: ['herb', 'consumable'],
    weight: 0.95,
    values: byQuality(0.96, 0.93, 0.89, 0.84, 0.79, 0.74, 0.68, 0.62),
  }),
  defineEffect({
    id: 'burden_world_ore',
    kind: 'burden',
    scope: 'world',
    effectType: 'reward_type_bias',
    label: '矿材机缘更易擦肩',
    tags: [CreationTags.MATERIAL.SEMANTIC_METAL],
    keywords: ['矿', '金铁', '器'],
    rewardTypes: ['ore', 'aux'],
    weight: 0.95,
    values: byQuality(0.96, 0.93, 0.89, 0.84, 0.79, 0.74, 0.68, 0.62),
  }),
  defineEffect({
    id: 'burden_world_monster',
    kind: 'burden',
    scope: 'world',
    effectType: 'reward_type_bias',
    label: '妖兽机缘更易擦肩',
    tags: [CreationTags.MATERIAL.SEMANTIC_BEAST],
    keywords: ['兽', '血', '猎'],
    rewardTypes: ['monster', 'consumable'],
    weight: 0.9,
    values: byQuality(0.96, 0.93, 0.89, 0.84, 0.79, 0.74, 0.68, 0.62),
  }),
  defineEffect({
    id: 'burden_world_quality',
    kind: 'burden',
    scope: 'world',
    effectType: 'reward_score_multiplier',
    label: '整体机缘更易走偏',
    tags: [CreationTags.MATERIAL.SEMANTIC_QI],
    keywords: ['歧路', '偏折', '走偏'],
    weight: 0.8,
    values: byQuality(0.98, 0.96, 0.93, 0.89, 0.84, 0.79, 0.73, 0.67),
  }),
] as const satisfies readonly FateEffectFragmentDefinition[];

const FATE_RARE_FRAGMENTS = [
  defineEffect({
    id: 'rare_blade_extreme',
    kind: 'rare',
    scope: 'creation',
    effectType: 'creation_tag_bias',
    label: '锋刃词缀极易成形',
    tags: [
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_METAL,
    ],
    keywords: ['剑', '锋', '斩'],
    weight: 0.9,
    minQuality: '玄品',
    values: byQuality(0.5, 0.6, 0.78, 0.94, 1.12, 1.32, 1.54, 1.8),
  }),
  defineEffect({
    id: 'rare_alchemy_extreme',
    kind: 'rare',
    scope: 'creation',
    effectType: 'creation_tag_bias',
    label: '丹道词缀极易成形',
    tags: [
      CreationTags.MATERIAL.SEMANTIC_ALCHEMY,
      CreationTags.MATERIAL.SEMANTIC_WOOD,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
    ],
    keywords: ['丹', '药', '草木'],
    weight: 0.9,
    minQuality: '玄品',
    values: byQuality(0.48, 0.58, 0.74, 0.9, 1.08, 1.26, 1.46, 1.7),
  }),
  defineEffect({
    id: 'rare_thunder_extreme',
    kind: 'rare',
    scope: 'creation',
    effectType: 'creation_tag_bias',
    label: '雷霆词缀极易成形',
    tags: [
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ],
    keywords: ['雷', '霆', '爆'],
    weight: 0.9,
    minQuality: '玄品',
    values: byQuality(0.52, 0.62, 0.8, 0.98, 1.18, 1.38, 1.6, 1.86),
  }),
  defineEffect({
    id: 'rare_spirit_extreme',
    kind: 'rare',
    scope: 'creation',
    effectType: 'creation_tag_bias',
    label: '悟理词缀极易成形',
    tags: [
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_SPACE,
    ],
    keywords: ['悟', '经', '界隙'],
    weight: 0.9,
    minQuality: '玄品',
    values: byQuality(0.44, 0.54, 0.7, 0.86, 1.02, 1.18, 1.36, 1.58),
  }),
  defineEffect({
    id: 'rare_insight_extreme',
    kind: 'rare',
    scope: 'cultivation',
    effectType: 'insight_gain_multiplier',
    label: '顿悟时机更盛',
    tags: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
    keywords: ['悟', '明', '推演'],
    weight: 0.85,
    minQuality: '玄品',
    values: byQuality(1.08, 1.1, 1.16, 1.2, 1.25, 1.31, 1.38, 1.46),
  }),
  defineEffect({
    id: 'rare_breakthrough_extreme',
    kind: 'rare',
    scope: 'breakthrough',
    effectType: 'breakthrough_bonus',
    label: '冲关临门更近',
    tags: [CreationTags.MATERIAL.SEMANTIC_BURST],
    keywords: ['破关', '临门', '险'],
    weight: 0.85,
    minQuality: '玄品',
    values: byQuality(0.015, 0.02, 0.03, 0.04, 0.052, 0.065, 0.078, 0.092),
  }),
  defineEffect({
    id: 'rare_world_quality_extreme',
    kind: 'rare',
    scope: 'world',
    effectType: 'reward_score_multiplier',
    label: '大机缘更易近身',
    tags: [CreationTags.MATERIAL.SEMANTIC_QI],
    keywords: ['气运', '大机缘', '命数'],
    weight: 0.78,
    minQuality: '玄品',
    values: byQuality(1.05, 1.06, 1.1, 1.14, 1.19, 1.25, 1.31, 1.38),
  }),
  defineEffect({
    id: 'rare_world_monster_extreme',
    kind: 'rare',
    scope: 'world',
    effectType: 'reward_type_bias',
    label: '猎杀机缘极易近身',
    tags: [CreationTags.MATERIAL.SEMANTIC_BEAST],
    keywords: ['血', '兽', '猎'],
    rewardTypes: ['monster', 'consumable'],
    weight: 0.82,
    minQuality: '玄品',
    values: byQuality(1.1, 1.12, 1.2, 1.28, 1.36, 1.46, 1.58, 1.72),
  }),
  defineEffect({
    id: 'rare_world_herb_extreme',
    kind: 'rare',
    scope: 'world',
    effectType: 'reward_type_bias',
    label: '药园机缘极易近身',
    tags: [CreationTags.MATERIAL.SEMANTIC_ALCHEMY],
    keywords: ['药', '丹', '草木'],
    rewardTypes: ['herb', 'consumable'],
    weight: 0.82,
    minQuality: '玄品',
    values: byQuality(1.1, 1.12, 1.2, 1.28, 1.36, 1.46, 1.58, 1.72),
  }),
] as const satisfies readonly FateEffectFragmentDefinition[];

export function getAllFateCores(): FateCoreFragmentDefinition[] {
  return [...FATE_CORE_FRAGMENTS];
}

export function getFateBoonFragments(): FateEffectFragmentDefinition[] {
  return [...FATE_BOON_FRAGMENTS];
}

export function getFateBurdenFragments(): FateEffectFragmentDefinition[] {
  return [...FATE_BURDEN_FRAGMENTS];
}

export function getFateRareFragments(): FateEffectFragmentDefinition[] {
  return [...FATE_RARE_FRAGMENTS];
}

export function formatFateRootRequirement(
  requirement?: FateRootRequirement,
): string {
  if (!requirement?.anyOf.length) return '无特殊灵根要求';
  return `${requirement.anyOf.join(' / ')}灵根`;
}

export function buildLocalFateName(
  core: FateCoreFragmentDefinition,
  quality: Quality,
): string {
  const qualityPrefix =
    QUALITY_ORDER[quality] >= QUALITY_ORDER['仙品']
      ? '天'
      : QUALITY_ORDER[quality] >= QUALITY_ORDER['地品']
        ? '玄'
        : '';
  return `${qualityPrefix}${core.localNameRoot}${core.localSuffix}`;
}

export function buildLocalFateDescription(
  core: FateCoreFragmentDefinition,
  effects: FateEffectEntry[],
): string {
  const lines = effects
    .filter((effect) => effect.effectType !== 'encounter_hint')
    .slice(0, 2)
    .map((effect) => effect.label);
  if (lines.length === 0) {
    return core.localDescription;
  }
  return `${core.localDescription}其势所向：${lines.join('；')}。`;
}

export function summarizeFateAura(
  core: FateCoreFragmentDefinition,
  effects: FateEffectEntry[],
): string {
  const positives = effects
    .filter((effect) => effect.polarity === 'boon')
    .slice(0, 2)
    .map((effect) => effect.label);
  const negatives = effects
    .filter((effect) => effect.polarity === 'burden')
    .slice(0, 1)
    .map((effect) => effect.label);

  return [
    core.label,
    positives.length > 0 ? `顺势：${positives.join('，')}` : undefined,
    negatives.length > 0 ? `代价：${negatives.join('，')}` : undefined,
  ]
    .filter(Boolean)
    .join('；');
}

export function getQualityLadder(): Quality[] {
  return [...QUALITY_LADDER];
}
