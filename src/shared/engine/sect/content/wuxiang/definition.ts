import { AttributeType, ModifierType } from '@shared/engine/battle-v5/core/types';
import type { SectDefinitionWithoutPaths } from '../../core';
import {
  WUXIANG_DEMON_PATH_ID,
  WUXIANG_MIRROR_PATH_ID,
  WUXIANG_SECT_ID,
  WUXIANG_WAR_INTENT,
} from './ids';

export const WUXIANG_BASE_DEFINITION: SectDefinitionWithoutPaths = {
  id: WUXIANG_SECT_ID,
  name: '无相禅宗',
  description:
    '此宗不避魔心，不弃色身。门人以皮囊为道场，以气血燃业火；佛法用来照见诸苦，魔功用来横渡诸苦。',
  raceIds: ['human'],
  configVersion: 2,
  combatResource: {
    id: WUXIANG_WAR_INTENT,
    name: '战意',
    icon: '🔥',
    max: 6,
  },
  methods: [
    {
      id: 'wuxiang-canon', slot: 1, name: '《无相真解》', isPrimary: true,
      description: '观色身诸相皆无定相，于一念之间容佛、容魔，亦容无相。',
      perLevelDescription: '限制各分卷可研习的最高等级。',
    },
    {
      id: 'blood-lotus', slot: 2, name: '《血海生莲》',
      description: '血海不净，莲亦由此而生；知其污浊，方能借之渡身。',
      perLevelDescription: '每级提高0.05%最大气血。',
      modifierPerLevel: { attrType: AttributeType.MAX_HP, type: ModifierType.ADD, value: 0.0005 },
    },
    {
      id: 'white-bone', slot: 3, name: '《白骨照身》',
      description: '去皮肉浮相，见白骨本真；以朽坏之身承受来力。',
      perLevelDescription: '每级提高0.05%物理防御。',
      modifierPerLevel: { attrType: AttributeType.DEF, type: ModifierType.ADD, value: 0.0005 },
    },
    {
      id: 'wrathful-ming', slot: 4, name: '《明王降魔》',
      description: '明王怒目，不为嗔心，只借烈相斩断迟疑。',
      perLevelDescription: '每级提高0.05%物理攻击。',
      modifierPerLevel: { attrType: AttributeType.ATK, type: ModifierType.ADD, value: 0.0005 },
    },
    {
      id: 'six-senses', slot: 5, name: '《六根守识》',
      description: '声色香味触法皆至于前，心识自守，不随外境转移。',
      perLevelDescription: '每级提高0.02%控制抗性。',
      modifierPerLevel: { attrType: AttributeType.CONTROL_RESISTANCE, type: ModifierType.FIXED, value: 0.0002 },
    },
    {
      id: 'reed-crossing-method', slot: 6, name: '《一苇渡苦》',
      description: '苦海无边，轻身不待舟楫；一苇所向，只问彼岸。',
      perLevelDescription: '每级提高0.05%法术防御。',
      modifierPerLevel: { attrType: AttributeType.MAGIC_DEF, type: ModifierType.ADD, value: 0.0005 },
    },
  ],
  abilities: [
    { id: 'flower-heart', kind: 'default', baseName: '拈花叩心', description: '指间拈花，叩问的却是敌我同一颗心。佛相立其因，魔相照其果，无相令因果同现。', role: 'generator', unlock: { type: 'method', methodId: 'wuxiang-canon', level: 1 }, cooldown: 0 },
    { id: 'blood-tide', kind: 'active', baseName: '血海听潮', description: '不拒血海来潮，先听清每一道苦声从何处生，再于回澜时借势渡身。', role: 'defensive', unlock: { type: 'method', methodId: 'blood-lotus', level: 1 }, cooldown: 3 },
    { id: 'three-knocks', kind: 'active', baseName: '三叩业门', description: '一叩问因，二叩问果，三叩之后，门内门外皆由一念开合。', role: 'combo', unlock: { type: 'method', methodId: 'white-bone', level: 3 }, cooldown: 2 },
    { id: 'observe-calamity', kind: 'active', baseName: '闭目观劫', description: '闭目并非不见，而是不被劫相夺去心神；开眼之时，劫已照明。', role: 'defensive', unlock: { type: 'method', methodId: 'wrathful-ming', level: 3 }, cooldown: 4 },
    { id: 'five-skandhas', kind: 'active', baseName: '照见五蕴', description: '色受想行识逐一照破。佛相辨其虚实，魔相借火自渡，无相令诸蕴俱空。', role: 'utility', unlock: { type: 'method', methodId: 'six-senses', level: 3 }, cooldown: 3 },
    { id: 'reed-crossing', kind: 'active', baseName: '一苇横江', description: '江阔浪急，脚下只留一苇；佛相守住此岸，魔相强渡彼岸，无相则知两岸非岸。', role: 'defensive', unlock: { type: 'method', methodId: 'reed-crossing-method', level: 3 }, cooldown: 5 },
    { id: 'turn-form', kind: 'active', baseName: '一念未生', description: '战意未足时，一念尚伏于心；战意既成，佛、魔与无相只在翻掌之间。', role: 'finisher', unlock: { type: 'method', methodId: 'wuxiang-canon', level: 5 }, cooldown: 0 },
    { id: 'mirror-core', kind: 'passive', baseName: '明镜照业', description: '来力皆留其痕，因满果熟时照还来处。', role: 'defensive', unlock: { type: 'active_path', pathId: WUXIANG_MIRROR_PATH_ID }, visibility: 'internal' },
    { id: 'demon-core', kind: 'passive', baseName: '魔心渡厄', description: '以气血作舟、战意作楫，于一息将尽之际横渡生死。', role: 'combo', unlock: { type: 'active_path', pathId: WUXIANG_DEMON_PATH_ID }, visibility: 'internal' },
  ],
  onboarding: {
    initialContribution: 30,
    initialMethods: {
      'wuxiang-canon': 5,
      'blood-lotus': 3,
      'white-bone': 3,
      'wrathful-ming': 3,
      'six-senses': 3,
      'reed-crossing-method': 3,
    },
    initialAbilityLoadout: ['turn-form', 'blood-tide', 'three-knocks', 'observe-calamity'],
  },
};
