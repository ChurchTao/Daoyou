import {
  AttributeType,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import type { SectDefinitionWithoutPaths } from '../../core';
import {
  TIANYAN_DERIVATION,
  TIANYAN_HETU_PATH_ID,
  TIANYAN_LUOSHU_PATH_ID,
  TIANYAN_SECT_ID,
} from './ids';

export const TIANYAN_BASE_DEFINITION: SectDefinitionWithoutPaths = {
  id: TIANYAN_SECT_ID,
  name: '天衍圣地',
  description:
    '以五行法印推演前后术式的圣地。门人兼修金木水火土，却只能携四门主动神通入阵；胜负不在单法强弱，而在每一次留印之后如何落下下一子。',
  raceIds: ['human'],
  configVersion: 1,
  combatResource: {
    id: TIANYAN_DERIVATION,
    name: '衍数',
    icon: '✨',
    max: 3,
  },
  methods: [
    {
      id: 'tianyan-canon',
      slot: 1,
      name: '《天衍五行真经》',
      isPrimary: true,
      description:
        '以太初为纸，以五行为字。经中不求写尽天数，只教门人辨明一法之后仍有多少去处。',
      perLevelDescription: '限制其余五卷可研习的最高等级。',
    },
    {
      id: 'wood-vitality',
      slot: 2,
      name: '《青华生元录》',
      description:
        '草木荣枯并非两事；生机藏在未尽之处，也藏在愿意重新开始的一息里。',
      perLevelDescription: '每级提高0.05%最大气血。',
      modifierPerLevel: {
        attrType: AttributeType.MAX_HP,
        type: ModifierType.ADD,
        value: 0.0005,
      },
    },
    {
      id: 'fire-illumination',
      slot: 3,
      name: '《离明流火章》',
      description:
        '火能照见，也能焚去。持火者先辨所燃为何，方知余烬应当归向何处。',
      perLevelDescription: '每级提高0.05%法术攻击。',
      modifierPerLevel: {
        attrType: AttributeType.MAGIC_ATK,
        type: ModifierType.ADD,
        value: 0.0005,
      },
    },
    {
      id: 'earth-bearing',
      slot: 4,
      name: '《坤舆载物篇》',
      description:
        '地不与万物争先，却承受每一次落下的重量；能载其重，才能改其势。',
      perLevelDescription: '每级提高0.05%法术防御。',
      modifierPerLevel: {
        attrType: AttributeType.MAGIC_DEF,
        type: ModifierType.ADD,
        value: 0.0005,
      },
    },
    {
      id: 'metal-severing',
      slot: 5,
      name: '《太白裁虚诀》',
      description:
        '金气不只断形，也裁去遮蔽与虚妄。锋芒所至，应先知道何物不必留下。',
      perLevelDescription: '每级提高0.01个百分点法术穿透。',
      modifierPerLevel: {
        attrType: AttributeType.MAGIC_PENETRATION,
        type: ModifierType.FIXED,
        value: 0.0001,
      },
    },
    {
      id: 'water-flowing',
      slot: 6,
      name: '《玄冥行川法》',
      description:
        '水无常形，不与一岸相争。去路既改，仍能在曲折中守住归处。',
      perLevelDescription: '每级提高0.05%最大法力。',
      modifierPerLevel: {
        attrType: AttributeType.MAX_MP,
        type: ModifierType.ADD,
        value: 0.0005,
      },
    },
  ],
  abilities: [
    {
      id: 'primordial-ray',
      kind: 'default',
      baseName: '太初玄光',
      description:
        '太初灵气无色无形，不入五行。指间玄光只问命中，不替之后的变化作答。',
      role: 'generator',
      unlock: { type: 'method', methodId: 'tianyan-canon', level: 1 },
      mpCost: 0,
      cooldown: 0,
    },
    {
      id: 'verdant-pulse',
      kind: 'active',
      baseName: '青萝生脉',
      description:
        '青萝循气而生，一端缠住敌势，一端牵回施术者尚未断绝的生机。',
      role: 'generator',
      unlock: { type: 'method', methodId: 'wood-vitality', level: 1 },
      mpCost: 22,
      cooldown: 0,
    },
    {
      id: 'myriad-wood-renewal',
      kind: 'active',
      baseName: '万木回春',
      description:
        '不催枯枝强生新叶，只把散落的生机逐寸引回，使该续的一息重新接上。',
      role: 'defensive',
      unlock: { type: 'method', methodId: 'wood-vitality', level: 5 },
      mpCost: 36,
      cooldown: 4,
    },
    {
      id: 'flowing-flame',
      kind: 'active',
      baseName: '离火流照',
      description:
        '离火不作一瞬暴烈，沿气机流照而过；光所及处，余焰仍在暗中寻找可燃之物。',
      role: 'combo',
      unlock: { type: 'method', methodId: 'fire-illumination', level: 1 },
      mpCost: 28,
      cooldown: 0,
    },
    {
      id: 'lotus-in-fire',
      kind: 'active',
      baseName: '火里种莲',
      description:
        '借一线心火焚去附骨之秽，又在余烬中留下一点不肯熄灭的明光。',
      role: 'utility',
      unlock: { type: 'method', methodId: 'fire-illumination', level: 5 },
      costs: [
        {
          resource: 'hp',
          mode: 'current_hp_ratio',
          ratio: 0.05,
          minimum: 1,
          retain: 1,
        },
      ],
      cooldown: 4,
    },
    {
      id: 'earth-bearing-seal',
      kind: 'active',
      baseName: '坤岳镇形',
      description:
        '坤气落下，不急于压碎敌形，先在施术者身前立住一座可承来力的山岳。',
      role: 'defensive',
      unlock: { type: 'method', methodId: 'earth-bearing', level: 1 },
      mpCost: 24,
      cooldown: 0,
    },
    {
      id: 'boundless-earth',
      kind: 'active',
      baseName: '地载无疆',
      description:
        '地不拒轻重，也不问来处。法域展开之时，落在其中的每一道力量都先由厚土承接。',
      role: 'defensive',
      unlock: { type: 'method', methodId: 'earth-bearing', level: 5 },
      mpCost: 42,
      cooldown: 5,
    },
    {
      id: 'metal-cloud-cutter',
      kind: 'active',
      baseName: '庚金裁云',
      description:
        '庚金凝成一线，所裁并非云气，而是藏在云后的护持与虚势。',
      role: 'finisher',
      unlock: { type: 'method', methodId: 'metal-severing', level: 1 },
      mpCost: 30,
      cooldown: 0,
    },
    {
      id: 'white-star-breaker',
      kind: 'active',
      baseName: '太白破阵',
      description:
        '太白一线照入阵眼，先去遮蔽，再断灵机；锋芒不求伤重，只求所见再无虚假。',
      role: 'utility',
      unlock: { type: 'method', methodId: 'metal-severing', level: 5 },
      mpCost: 34,
      cooldown: 2,
    },
    {
      id: 'dark-water-return',
      kind: 'active',
      baseName: '玄水回澜',
      description:
        '玄水不与来势正争，只在回澜时带走立足之力，使快者迟、满者退。',
      role: 'utility',
      unlock: { type: 'method', methodId: 'water-flowing', level: 1 },
      mpCost: 26,
      cooldown: 0,
    },
    {
      id: 'heavenly-river-cleansing',
      kind: 'active',
      baseName: '天河洗心',
      description:
        '引天河过心窍，不洗记忆，也不洗选择，只带走此刻不应继续停留的浊意。',
      role: 'utility',
      unlock: { type: 'method', methodId: 'water-flowing', level: 5 },
      mpCost: 30,
      cooldown: 4,
    },
    {
      id: 'shift-palace',
      kind: 'active',
      baseName: '移宫换宿',
      description:
        '星宿未移，观测之宫先改。法印沿相生次序转过一位，原本无路的下一法便有了新的去处。',
      role: 'utility',
      unlock: { type: 'method', methodId: 'tianyan-canon', level: 5 },
      mpCost: 20,
      cooldown: 2,
    },
    {
      id: 'five-qi-repository',
      kind: 'active',
      baseName: '五气归藏',
      description:
        '推演不必每次走到尽头。将尚未用尽的法印收回太初，余势仍可归为护身、养气与下一法的凭依。',
      role: 'utility',
      unlock: { type: 'method', methodId: 'tianyan-canon', level: 10 },
      mpCost: 16,
      cooldown: 4,
    },
    {
      id: 'tianyan-runtime',
      kind: 'passive',
      baseName: '太初衍脉',
      description:
        '太初灵气本无定色。天衍神通不受异灵根失配影响；与本命灵根相同的法术仍可获得灵根共鸣。',
      role: 'combo',
      unlock: { type: 'always' },
      visibility: 'internal',
    },
    {
      id: 'hetu-runtime',
      kind: 'passive',
      baseName: '河图周天',
      description: '三数成图，令伤势、气血与法力在同一轮转中续接。',
      role: 'combo',
      unlock: { type: 'active_path', pathId: TIANYAN_HETU_PATH_ID },
      visibility: 'internal',
    },
    {
      id: 'luoshu-runtime',
      kind: 'passive',
      baseName: '洛书断局',
      description: '三数定局，在敌势成形之前追加一次无属性断击。',
      role: 'finisher',
      unlock: { type: 'active_path', pathId: TIANYAN_LUOSHU_PATH_ID },
      visibility: 'internal',
    },
  ],
  onboarding: {
    initialContribution: 30,
    initialMethods: {
      'tianyan-canon': 5,
      'wood-vitality': 1,
      'fire-illumination': 1,
      'earth-bearing': 1,
      'metal-severing': 1,
      'water-flowing': 1,
    },
    initialAbilityLoadout: [
      'verdant-pulse',
      'flowing-flame',
      'dark-water-return',
      'shift-palace',
    ],
  },
};
