import type { SkillDef, StatusDef } from '@daoyou/combat-core/types';
import type { RealmType } from '@daoyou/constants/realms';
import type { BreakthroughChallengeId } from '@daoyou/game-domain/combat/challenges';

// 固定在当前大境界圆满的预算；不随挑战者的装备、心法或灵兽上涨。
export const BREAKTHROUGH_CHALLENGES = {
  foundation_qi: {
    title: '伏息筑基',
    name: '伏息石蟾',
    attackType: 'physical',
    fromRealm: '炼气',
    hp: 2,
    attack: 1.05,
    skills: ['breakthrough.stale-breath'],
  },
  core_condensation: {
    title: '离火凝丹',
    name: '离火丹螭',
    attackType: 'spell',
    fromRealm: '筑基',
    hp: 2.1,
    attack: 1,
    skills: ['breakthrough.furnace-flame'],
  },
  heart_demon_nascent: {
    title: '心魔劫',
    name: '照妄影',
    attackType: 'spell',
    fromRealm: '金丹',
    hp: 2.2,
    attack: 1,
    skills: ['breakthrough.delusion', 'breakthrough.obsession'],
  },
  tribulation_deity: {
    title: '化神之扰',
    name: '叩神雷鹤',
    attackType: 'spell',
    fromRealm: '元婴',
    hp: 2.3,
    attack: 1.05,
    skills: ['breakthrough.thunder-wings'],
  },
  law_insight_void: {
    title: '法则试锋',
    name: '缚虚断碑',
    attackType: 'spell',
    fromRealm: '化神',
    hp: 2.5,
    attack: 1.05,
    skills: ['breakthrough.rift'],
  },
  tribulation_body: {
    title: '雷劫淬体',
    name: '负岳雷鼋',
    attackType: 'physical',
    fromRealm: '炼虚',
    hp: 2.5,
    attack: 1.05,
    skills: ['breakthrough.thunder-shell', 'breakthrough.mountain-strike'],
  },
  inner_demon_grand: {
    title: '大执念劫',
    name: '抱匣枯猿',
    attackType: 'physical',
    fromRealm: '合体',
    hp: 2.7,
    attack: 1.1,
    skills: ['breakthrough.empty-casket'],
  },
  heavenly_tribulation_final: {
    title: '天劫前奏',
    name: '天衡残钟',
    attackType: 'spell',
    fromRealm: '大乘',
    hp: 2.9,
    attack: 1.1,
    skills: ['breakthrough.heavenly-chime', 'breakthrough.last-chime'],
  },
} as const satisfies Record<
  BreakthroughChallengeId,
  {
    title: string;
    name: string;
    fromRealm: RealmType;
    hp: number;
    attack: number;
    attackType: 'physical' | 'spell';
    skills: readonly string[];
  }
>;

export const BREAKTHROUGH_STATUS_DEFS: StatusDef[] = [
  {
    id: 'breakthrough.obsession',
    name: '妄念炽盛',
    kind: 'breakthrough.obsession',
    category: 'buff',
    untilBattleEnd: true,
    damageDealtPhysical: 1.15,
    damageDealtSpell: 1.15,
  },
  {
    id: 'breakthrough.rift-exposed',
    name: '法环裂隙',
    kind: 'breakthrough.rift-exposed',
    category: 'debuff',
    damageTakenPhysical: 1.25,
    damageTakenSpell: 1.25,
  },
  {
    id: 'breakthrough.thunder-shell',
    name: '负岳雷甲',
    kind: 'breakthrough.thunder-shell',
    category: 'buff',
    untilBattleEnd: true,
    dispellable: false,
    damageTakenPhysical: 0.85,
    damageTakenSpell: 0.9,
  },
  {
    id: 'breakthrough.empty-casket',
    name: '空匣执念',
    kind: 'breakthrough.empty-casket',
    category: 'debuff',
    healTaken: 0.7,
  },
  {
    id: 'breakthrough.last-chime',
    name: '末劫余响',
    kind: 'breakthrough.last-chime',
    category: 'buff',
    untilBattleEnd: true,
    damageDealtPhysical: 1.2,
    damageDealtSpell: 1.2,
  },
];

export const BREAKTHROUGH_SKILLS: SkillDef[] = [
  {
    id: 'breakthrough.stale-breath',
    name: '浊息压脉',
    description: '浊息沉落，检验气血与基础攻防。',
    tags: ['physical'],
    targeting: { side: 'enemy', count: 1 },
    effects: [{ type: 'physicalHit', coeff: 1, power: 'skillLevel * 0.3' }],
  },
  {
    id: 'breakthrough.furnace-flame',
    name: '离火吐丹',
    description: '逸散丹火冲击经脉，检验凝丹前的法术防护。',
    tags: ['spell'],
    targeting: { side: 'enemy', count: 1 },
    effects: [{ type: 'spellHit', coeff: 1, power: '10 + skillLevel' }],
  },
  {
    id: 'breakthrough.delusion',
    name: '照见妄心',
    description: '心魔以凝滞的旧念冲击识海。',
    tags: ['spell'],
    targeting: { side: 'enemy', count: 1 },
    effects: [{ type: 'spellHit', coeff: 1, power: '20 + skillLevel' }],
  },
  {
    id: 'breakthrough.obsession',
    name: '妄念炽盛',
    description: '半血后妄念反扑，造成的伤害提高。',
    tags: ['passive'],
    targeting: { side: 'self' },
    effects: [],
    hooks: [
      {
        on: 'onRoundStart',
        aim: 'self',
        when: {
          sourceStanding: true,
          sourceHpRatioBelow: 0.5,
          oncePerBattle: true,
        },
        effects: [
          {
            type: 'applyStatus',
            statusId: 'breakthrough.obsession',
            duration: 1,
            self: true,
          },
        ],
      },
    ],
  },
  {
    id: 'breakthrough.thunder-wings',
    name: '振羽叩神',
    description: '雷羽同时扫向人物与在场灵兽。',
    tags: ['spell'],
    targeting: { side: 'enemy', mode: 'fill', count: 2 },
    effects: [{ type: 'spellHit', coeff: 0.8, power: '30 + skillLevel * 0.8' }],
  },
  {
    id: 'breakthrough.rift',
    name: '断碑开界',
    description: '强攻撕开法环，出手后自身短暂暴露。',
    tags: ['spell'],
    cooldownRounds: 2,
    targeting: { side: 'enemy', count: 1 },
    effects: [{ type: 'spellHit', coeff: 1.25, power: '30 + skillLevel' }],
    hooks: [
      {
        on: 'afterAction',
        sourceIsSelf: true,
        aim: 'self',
        when: { skillIds: ['breakthrough.rift'], actionSucceeded: true },
        effects: [
          {
            type: 'applyStatus',
            statusId: 'breakthrough.rift-exposed',
            duration: 2,
            self: true,
          },
        ],
      },
    ],
  },
  {
    id: 'breakthrough.thunder-shell',
    name: '负岳雷甲',
    description: '雷甲减轻物理与法术伤害。',
    tags: ['passive'],
    targeting: { side: 'self' },
    effects: [],
    innate: {
      entryStatus: {
        statusId: 'breakthrough.thunder-shell',
        minDuration: 1,
        maxDuration: 1,
      },
    },
  },
  {
    id: 'breakthrough.mountain-strike',
    name: '负岳震脉',
    description: '以负岳之重检验道体根基。',
    tags: ['physical'],
    targeting: { side: 'enemy', count: 1 },
    effects: [{ type: 'physicalHit', coeff: 1.1, power: 'skillLevel * 0.4' }],
  },
  {
    id: 'breakthrough.empty-casket',
    name: '空匣攫念',
    description: '消耗对手法力，并削弱短时间内受到的治疗。',
    tags: ['physical'],
    targeting: { side: 'enemy', count: 1 },
    effects: [
      { type: 'physicalHit', coeff: 0.9 },
      { type: 'damageMp', power: '15 + skillLevel * 0.2' },
      {
        type: 'applyStatus',
        statusId: 'breakthrough.empty-casket',
        duration: 2,
      },
    ],
  },
  {
    id: 'breakthrough.heavenly-chime',
    name: '天衡钟鸣',
    description: '钟声同时震荡人物与灵兽，检验形神两端。',
    tags: ['spell'],
    cooldownRounds: 2,
    targeting: { side: 'enemy', mode: 'fill', count: 2 },
    effects: [{ type: 'spellHit', coeff: 0.9, power: '40 + skillLevel' }],
  },
  {
    id: 'breakthrough.last-chime',
    name: '末劫余响',
    description: '气血不足三成时，残钟激发末劫余响。',
    tags: ['passive'],
    targeting: { side: 'self' },
    effects: [],
    hooks: [
      {
        on: 'onRoundStart',
        aim: 'self',
        when: {
          sourceStanding: true,
          sourceHpRatioBelow: 0.3,
          oncePerBattle: true,
        },
        effects: [
          {
            type: 'applyStatus',
            statusId: 'breakthrough.last-chime',
            duration: 1,
            self: true,
          },
        ],
      },
    ],
  },
];
