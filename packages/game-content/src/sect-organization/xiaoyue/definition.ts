import type { SectDefinition } from '@daoyou/game-domain/sects';
import { XIAOYUE_SECT_ID } from './ids.js';

/** 组织传承索引；战斗技能和经脉以 V6 内容为准。 */
export const XIAOYUE_DEFINITION: SectDefinition = {
  id: XIAOYUE_SECT_ID,
  name: '百兽崖',
  description:
    '南疆十万大山深处，百兽崖门人以山林万类为师，与灵兽平等同行。观其形、通其息，悟出吐纳与战法；临战或演化兽形，或与自己的出战灵兽相应。',
  raceIds: ['human'],
  configVersion: 1,
  methods: [
    {
      id: 'xiaoyue.method.canon',
      slot: 1,
      name: '《百兽化形》',
      description: '观山林百兽的形与息，悟得自身演化兽形的根基。',
      isPrimary: true,
    },
    {
      id: 'xiaoyue.method.onslaught',
      slot: 2,
      name: '《生死搏》',
      description: '练近身扑击与腾空疾袭，于一瞬之间判定进退。',
    },
    {
      id: 'xiaoyue.method.beast',
      slot: 3,
      name: '《驭灵诀》',
      description: '与灵兽同息相应，各守其性，在并肩行进中悟得协同之法。',
    },
    {
      id: 'xiaoyue.method.fury',
      slot: 4,
      name: '《狂兽诀》',
      description: '以连绵攻势逼敌失守，出手越急，越要守住气息。',
    },
    {
      id: 'xiaoyue.method.wing',
      slot: 5,
      name: '《观羽步》',
      description: '观飞鸟振羽与转折，习其避让腾挪之法，练成崖间身法。',
    },
    {
      id: 'xiaoyue.method.guard',
      slot: 6,
      name: '《伏形诀》',
      description: '观山兽伏身护体之势，守住气息，于承击后寻机反扑。',
    },
  ],
  abilities: [
    {
      // 组织传承的默认条目，不编入 V6 技能或学习目录。
      id: 'xiaoyue.organization.observe',
      kind: 'default',
      baseName: '观兽',
      description: '入崖先观山林万类之形，战斗中仍依当前已学神通行事。',
      role: 'utility',
      visibility: 'internal',
      unlock: { type: 'method', methodId: 'xiaoyue.method.canon', level: 1 },
    },
    {
      id: 'xiaoyue.skill.transform',
      kind: 'active',
      baseName: '兽形',
      description: '凝聚兽形之势，获得后续攻势的施展资格。',
      role: 'utility',
      unlock: { type: 'method', methodId: 'xiaoyue.method.canon', level: 20 },
    },
    {
      id: 'xiaoyue.skill.lion_strike',
      kind: 'active',
      baseName: '狮搏',
      description: '借兽形之势猛扑一名敌人。',
      role: 'finisher',
      unlock: { type: 'method', methodId: 'xiaoyue.method.onslaught', level: 20 },
    },
    {
      id: 'xiaoyue.skill.eagle_strike',
      kind: 'active',
      baseName: '鹏击',
      description: '腾空扑击敌阵，出手后须回气。',
      role: 'generator',
      unlock: { type: 'method', methodId: 'xiaoyue.method.onslaught', level: 30 },
    },
    {
      id: 'xiaoyue.skill.intimidate',
      kind: 'active',
      baseName: '兽威',
      description: '借观兽所得的威吓战法，扰乱敌方灵兽或普通生灵的攻势。',
      role: 'utility',
      unlock: { type: 'method', methodId: 'xiaoyue.method.beast', level: 15 },
    },
    {
      id: 'xiaoyue.skill.chain_strike',
      kind: 'active',
      baseName: '连环击',
      description: '连续猛攻一名敌人，出手后须回气。',
      role: 'finisher',
      unlock: { type: 'method', methodId: 'xiaoyue.method.fury', level: 30 },
    },
    {
      id: 'xiaoyue.organization.wing',
      kind: 'passive',
      baseName: '鹏翼身法',
      description: '观羽步的组织传承索引，战斗效果以 V6 心法为准。',
      role: 'utility',
      visibility: 'internal',
      sourceMethodId: 'xiaoyue.method.wing',
      unlock: { type: 'always' },
    },
    {
      id: 'xiaoyue.skill.frenzy',
      kind: 'active',
      baseName: '狂反',
      description: '承受物理攻击时伺机反扑。',
      role: 'defensive',
      unlock: { type: 'method', methodId: 'xiaoyue.method.guard', level: 20 },
    },
  ],
  paths: [],
  onboarding: {
    initialContribution: 0,
    initialMethods: {
      'xiaoyue.method.canon': 1,
      'xiaoyue.method.onslaught': 1,
      'xiaoyue.method.beast': 1,
      'xiaoyue.method.fury': 1,
      'xiaoyue.method.wing': 1,
      'xiaoyue.method.guard': 1,
    },
    initialAbilityLoadout: [null, null, null, null],
  },
};
