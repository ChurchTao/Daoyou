import { CreationTags } from '@/engine/shared/tag-domain';
import type { Quality } from '@/types/constants';
import type { PreHeavenFate } from '@/types/cultivator';

export interface FatePolicyDefinition extends PreHeavenFate {
  registryKey: string;
  quality: Quality;
  tags: string[];
  growthBias: NonNullable<PreHeavenFate['growthBias']>;
  worldBias: NonNullable<PreHeavenFate['worldBias']>;
  tradeoffs: NonNullable<PreHeavenFate['tradeoffs']>;
}

function defineFate(
  definition: FatePolicyDefinition,
): FatePolicyDefinition {
  return definition;
}

const FATE_DEFINITIONS = [
  defineFate({
    registryKey: 'innate_sword_saint_body',
    name: '先天剑修圣体',
    quality: '天品',
    description:
      '天生与锋芒相契，悟剑、寻剑、破关皆得天机眷顾，但越偏离剑道，所得便越散。',
    tags: ['sword', 'metal', 'bias:blade'],
    growthBias: {
      creationTags: [
        CreationTags.MATERIAL.SEMANTIC_BLADE,
        CreationTags.MATERIAL.SEMANTIC_METAL,
      ],
      cultivationExpMultiplier: 1.08,
      insightGainMultiplier: 1.1,
      breakthroughChanceBonus: 0.04,
    },
    worldBias: {
      encounterHints: ['剑修遗府', '锋金矿脉', '残缺剑经'],
      preferredRewardTypes: ['skill_manual', 'gongfa_manual', 'ore'],
      rewardScoreMultiplier: 1.12,
    },
    tradeoffs: [
      {
        scope: 'creation',
        description: '兼修杂道时心神不宁，非锋刃取向的造物更难圆融。',
        creationTags: [
          CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
          CreationTags.MATERIAL.SEMANTIC_ALCHEMY,
          CreationTags.MATERIAL.SEMANTIC_GUARD,
        ],
        multiplier: 0.78,
      },
      {
        scope: 'world',
        description: '遇见非剑道机缘时更容易错身而过。',
        rewardTypes: ['herb', 'consumable'],
        multiplier: 0.88,
      },
    ],
  }),
  defineFate({
    registryKey: 'verdant_alchemy_heart',
    name: '青木丹心',
    quality: '地品',
    description:
      '药性与木气天然亲和，炼丹、疗养、洗髓方面格外顺手，但杀伐与爆发之路总差一口锐气。',
    tags: ['alchemy', 'wood', 'healing'],
    growthBias: {
      creationTags: [
        CreationTags.MATERIAL.SEMANTIC_WOOD,
        CreationTags.MATERIAL.SEMANTIC_ALCHEMY,
        CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      ],
      cultivationExpMultiplier: 1.04,
      insightGainMultiplier: 1.12,
      breakthroughChanceBonus: 0.01,
    },
    worldBias: {
      encounterHints: ['古药园', '丹师遗府', '灵植秘境'],
      preferredRewardTypes: ['herb', 'consumable', 'tcdb'],
      rewardScoreMultiplier: 1.14,
    },
    tradeoffs: [
      {
        scope: 'creation',
        description: '爆发、攻伐类造物难得圆满，锋锐一途总显后劲不足。',
        creationTags: [
          CreationTags.MATERIAL.SEMANTIC_BLADE,
          CreationTags.MATERIAL.SEMANTIC_BURST,
        ],
        multiplier: 0.8,
      },
      {
        scope: 'breakthrough',
        description: '一味求稳，硬闯型突破时心气略显不足。',
        breakthroughChanceBonus: -0.02,
      },
    ],
  }),
  defineFate({
    registryKey: 'thunder_true_vein',
    name: '雷殛真脉',
    quality: '天品',
    description:
      '雷机贯体，适合走凌厉突进的路数，破关时敢压生死线，但在温养、护持方面难得细腻。',
    tags: ['thunder', 'burst'],
    growthBias: {
      creationTags: [
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
        CreationTags.MATERIAL.SEMANTIC_BURST,
      ],
      cultivationExpMultiplier: 1.06,
      insightGainMultiplier: 1.03,
      breakthroughChanceBonus: 0.05,
    },
    worldBias: {
      encounterHints: ['雷池残域', '天劫旧场'],
      preferredRewardTypes: ['ore', 'monster', 'skill_manual'],
      rewardScoreMultiplier: 1.1,
    },
    tradeoffs: [
      {
        scope: 'creation',
        description: '守御、疗养类造物时雷机躁动，成器稳定性明显下降。',
        creationTags: [
          CreationTags.MATERIAL.SEMANTIC_GUARD,
          CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
        ],
        multiplier: 0.82,
      },
    ],
  }),
  defineFate({
    registryKey: 'void_mirror_spirit_platform',
    name: '空明灵台',
    quality: '真品',
    description:
      '神识澄明，悟法、读经、推演奇遇都更易看到暗线，但若一味务虚，根基打磨反而偏慢。',
    tags: ['spirit', 'space', 'manual'],
    growthBias: {
      creationTags: [
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_MANUAL,
        CreationTags.MATERIAL.SEMANTIC_SPACE,
      ],
      cultivationExpMultiplier: 0.98,
      insightGainMultiplier: 1.18,
      breakthroughChanceBonus: 0.03,
    },
    worldBias: {
      encounterHints: ['藏经阁暗门', '界隙残痕', '心神试炼'],
      preferredRewardTypes: ['gongfa_manual', 'skill_manual', 'aux'],
      rewardScoreMultiplier: 1.09,
    },
    tradeoffs: [
      {
        scope: 'cultivation',
        description: '太重悟理，日常苦修的实打实积累会慢上几分。',
        multiplier: 0.9,
      },
    ],
  }),
  defineFate({
    registryKey: 'mountain_guard_body',
    name: '厚土载岳体',
    quality: '真品',
    description:
      '道基稳固，适合守成、打底与长期闭关，但变化与机动性不足，越求花巧越难得利。',
    tags: ['earth', 'guard'],
    growthBias: {
      creationTags: [
        CreationTags.MATERIAL.SEMANTIC_EARTH,
        CreationTags.MATERIAL.SEMANTIC_GUARD,
      ],
      cultivationExpMultiplier: 1.06,
      insightGainMultiplier: 1.02,
      breakthroughChanceBonus: 0.03,
    },
    worldBias: {
      encounterHints: ['地脉洞窟', '古阵基石', '镇岳遗址'],
      preferredRewardTypes: ['ore', 'aux', 'gongfa_manual'],
      rewardScoreMultiplier: 1.08,
    },
    tradeoffs: [
      {
        scope: 'creation',
        description: '追求轻灵、幻变、爆发时总显笨拙。',
        creationTags: [
          CreationTags.MATERIAL.SEMANTIC_WIND,
          CreationTags.MATERIAL.SEMANTIC_ILLUSION,
          CreationTags.MATERIAL.SEMANTIC_BURST,
        ],
        multiplier: 0.82,
      },
    ],
  }),
  defineFate({
    registryKey: 'blood_hunt_overlord_frame',
    name: '血狩霸骨',
    quality: '玄品',
    description:
      '血煞与兽性相生，偏向猎杀、妖兽机缘与强夺式突破，但心境难静，读经悟法总少三分耐性。',
    tags: ['blood', 'beast', 'poison'],
    growthBias: {
      creationTags: [
        CreationTags.MATERIAL.SEMANTIC_BLOOD,
        CreationTags.MATERIAL.SEMANTIC_BEAST,
        CreationTags.MATERIAL.SEMANTIC_POISON,
      ],
      cultivationExpMultiplier: 1.07,
      insightGainMultiplier: 0.94,
      breakthroughChanceBonus: 0.02,
    },
    worldBias: {
      encounterHints: ['妖兽巢穴', '血祭遗坛'],
      preferredRewardTypes: ['monster', 'consumable'],
      rewardScoreMultiplier: 1.11,
    },
    tradeoffs: [
      {
        scope: 'world',
        description: '典籍与静修类机缘往往与你擦肩而过。',
        rewardTypes: ['gongfa_manual', 'skill_manual'],
        multiplier: 0.83,
      },
    ],
  }),
  defineFate({
    registryKey: 'flowing_water_qi_bone',
    name: '流波灵骨',
    quality: '玄品',
    description:
      '水行绵长，回气、调息、延续型修行都更顺，但爆发破局时往往缺少一锤定音的决断。',
    tags: ['water', 'sustain'],
    growthBias: {
      creationTags: [
        CreationTags.MATERIAL.SEMANTIC_WATER,
        CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      ],
      cultivationExpMultiplier: 1.03,
      insightGainMultiplier: 1.06,
      breakthroughChanceBonus: 0.01,
    },
    worldBias: {
      encounterHints: ['水府秘藏', '潮汐灵穴'],
      preferredRewardTypes: ['herb', 'aux', 'consumable'],
      rewardScoreMultiplier: 1.07,
    },
    tradeoffs: [
      {
        scope: 'creation',
        description: '极端爆发、雷火相激的造物难以长久维持平衡。',
        creationTags: [
          CreationTags.MATERIAL.SEMANTIC_THUNDER,
          CreationTags.MATERIAL.SEMANTIC_FLAME,
          CreationTags.MATERIAL.SEMANTIC_BURST,
        ],
        multiplier: 0.84,
      },
    ],
  }),
  defineFate({
    registryKey: 'time_withering_fruit',
    name: '蚀岁灵胎',
    quality: '地品',
    description:
      '对岁月和机缘嗅觉格外敏锐，常能提前捕捉转机，但修炼效率时涨时落，极依赖契机与环境。',
    tags: ['time', 'luck'],
    growthBias: {
      creationTags: [
        CreationTags.MATERIAL.SEMANTIC_TIME,
        CreationTags.MATERIAL.SEMANTIC_QI,
      ],
      cultivationExpMultiplier: 1.0,
      insightGainMultiplier: 1.08,
      breakthroughChanceBonus: 0.02,
    },
    worldBias: {
      encounterHints: ['岁月残阵', '旧纪遗物', '时序裂隙'],
      preferredRewardTypes: ['tcdb', 'aux', 'gongfa_manual'],
      rewardScoreMultiplier: 1.16,
    },
    tradeoffs: [
      {
        scope: 'cultivation',
        description: '若闭关环境平庸，收益容易大起大落，难得稳定。',
        multiplier: 0.95,
      },
    ],
  }),
] as const satisfies readonly FatePolicyDefinition[];

const FATE_BY_KEY = new Map(
  FATE_DEFINITIONS.map((definition) => [definition.registryKey, definition]),
);
const FATE_KEY_BY_NAME = new Map(
  FATE_DEFINITIONS.map((definition) => [definition.name, definition.registryKey]),
);

export const FATE_SLOT_COUNT = 3;
export const FATE_CANDIDATE_COUNT = 6;
export const FATE_REROLL_LIMIT = 5;

export function getAllFatePolicies(): FatePolicyDefinition[] {
  return [...FATE_DEFINITIONS];
}

export function getFatePolicyByRegistryKey(
  registryKey: string | undefined,
): FatePolicyDefinition | undefined {
  if (!registryKey) return undefined;
  return FATE_BY_KEY.get(registryKey);
}

export function getFatePolicyByName(
  name: string | undefined,
): FatePolicyDefinition | undefined {
  if (!name) return undefined;
  const registryKey = FATE_KEY_BY_NAME.get(name);
  if (!registryKey) return undefined;
  return FATE_BY_KEY.get(registryKey);
}

