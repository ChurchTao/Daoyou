import {
  AttributeType,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import type { SectDefinitionWithoutPaths } from '../../core';
import {
  YOUDU_SECT_ID,
  YOUDU_SOUL_FIRE,
} from './ids';

export const YOUDU_BASE_DEFINITION: SectDefinitionWithoutPaths = {
  id: YOUDU_SECT_ID,
  name: '幽都',
  description:
    '幽都门人通晓三魂七魄，以术伤侵形、魂伤越防，并用蚀魂逐层削弱敌人的攻防、速度与治疗。其术起势缓慢，却最擅长让强敌在不知不觉间失去还手之力。',
  raceIds: ['human'],
  configVersion: 1,
  combatResource: {
    id: YOUDU_SOUL_FIRE,
    name: '魂火',
    icon: '◈',
    max: 3,
  },
  methods: [
    {
      id: 'youdu-canon',
      slot: 1,
      name: '《幽都魂典》',
      isPrimary: true,
      description: '录三魂往复、七魄离合之理，是幽都诸法的总纲。',
      perLevelDescription: '限制其余五卷可研习的最高等级。',
    },
    {
      id: 'three-souls-separation',
      slot: 2,
      name: '《三魂离合篇》',
      description: '辨胎光、爽灵、幽精的去留，从影迹中寻出魂魄缝隙。',
      perLevelDescription: '每级提高0.05%法术攻击。',
      modifierPerLevel: {
        attrType: AttributeType.MAGIC_ATK,
        type: ModifierType.ADD,
        value: 0.0005,
      },
    },
    {
      id: 'forgetful-river-record',
      slot: 3,
      name: '《忘川渡夜录》',
      description: '记黑水涨落与游魂归路，令潮声在形神之间长久回荡。',
      perLevelDescription: '每级提高0.05%最大法力。',
      modifierPerLevel: {
        attrType: AttributeType.MAX_MP,
        type: ModifierType.ADD,
        value: 0.0005,
      },
    },
    {
      id: 'seven-souls-seizure',
      slot: 4,
      name: '《七魄夺形法》',
      description: '七魄各守形骸一处，去其一，身中灯火便暗一盏。',
      perLevelDescription: '每级提高0.02个百分点控制命中。',
      modifierPerLevel: {
        attrType: AttributeType.CONTROL_HIT,
        type: ModifierType.FIXED,
        value: 0.0002,
      },
    },
    {
      id: 'soul-pinning-ironbook',
      slot: 5,
      name: '《镇魂铁册》',
      description: '以幽都旧铁定影镇魂，使离散之魂不得妄动。',
      perLevelDescription: '每级提高0.05%法术防御。',
      modifierPerLevel: {
        attrType: AttributeType.MAGIC_DEF,
        type: ModifierType.ADD,
        value: 0.0005,
      },
    },
    {
      id: 'dead-heart-living-spirit',
      slot: 6,
      name: '《心死神活诀》',
      description: '心念寂处，神魂反得清明，不为外法轻易拘束。',
      perLevelDescription: '每级提高0.02个百分点控制抗性。',
      modifierPerLevel: {
        attrType: AttributeType.CONTROL_RESISTANCE,
        type: ModifierType.FIXED,
        value: 0.0002,
      },
    },
  ],
  abilities: [
    {
      id: 'one-sigh', kind: 'default', baseName: '一叹',
      description: '叹气若游丝，魂已松三分。', role: 'generator',
      unlock: { type: 'method', methodId: 'youdu-canon', level: 1 },
      mpCost: 0, cooldown: 0,
    },
    {
      id: 'soul-severing-call', kind: 'active', baseName: '离魂引',
      description: '循一声呼唤牵动游魂，魂愈远，越容易被引出形骸。', role: 'generator',
      unlock: { type: 'method', methodId: 'three-souls-separation', level: 1 },
      mpCost: 30, cooldown: 0,
    },
    {
      id: 'reveal-shadow', kind: 'active', baseName: '照影',
      description: '影者，魂之迹也；见影如见魂。', role: 'utility',
      unlock: { type: 'method', methodId: 'three-souls-separation', level: 5 },
      mpCost: 35, cooldown: 4,
    },
    {
      id: 'forgetful-river-tide', kind: 'active', baseName: '忘川潮',
      description: '黑水无舟，闻潮者各自忘归。', role: 'combo',
      unlock: { type: 'method', methodId: 'forgetful-river-record', level: 3 },
      mpCost: 45, cooldown: 3,
    },
    {
      id: 'seize-soul', kind: 'active', baseName: '夺魄',
      description: '七魄去其一，如灯灭一盏。', role: 'combo',
      unlock: { type: 'method', methodId: 'seven-souls-seizure', level: 3 },
      mpCost: 38, cooldown: 2,
    },
    {
      id: 'pin-soul', kind: 'active', baseName: '镇魂',
      description: '以幽都之铁钉住影迹，镇汝魂魄，不得妄动。', role: 'utility',
      unlock: { type: 'method', methodId: 'soul-pinning-ironbook', level: 5 },
      mpCost: 55, cooldown: 4,
    },
    {
      id: 'soul-shall-not-return', kind: 'active', baseName: '魂兮不归',
      description: '归来的呼声止于黑水，此后魂行千里，再无归路。', role: 'finisher',
      unlock: { type: 'method', methodId: 'youdu-canon', level: 10 },
      mpCost: 80, cooldown: 5,
    },
    {
      id: 'youdu-runtime', kind: 'passive', baseName: '心死神活',
      description: '常驻控制韧性，并在每场第一次受控后自行解脱。', role: 'defensive',
      unlock: { type: 'method', methodId: 'dead-heart-living-spirit', level: 1 }, visibility: 'internal',
    },
  ],
  onboarding: {
    initialContribution: 30,
    initialMethods: {
      'youdu-canon': 5,
      'three-souls-separation': 1,
      'forgetful-river-record': 1,
      'seven-souls-seizure': 1,
      'soul-pinning-ironbook': 1,
      'dead-heart-living-spirit': 1,
    },
    initialAbilityLoadout: ['soul-severing-call', null, null, null],
  },
};
