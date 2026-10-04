import type { BreakthroughChallengeId } from '@daoyou/game-domain/combat/challenges';



export const BREAKTHROUGH_CHALLENGES = {
  heart_demon_nascent: { title: '心魔劫', name: '心魔化身', hp: 1, attack: 1 },
  tribulation_deity: {
    title: '化神之扰',
    name: '天劫投影',
    hp: 2,
    attack: 1.1,
  },
  law_insight_void: {
    title: '法则试锋',
    name: '法则残影',
    hp: 2.2,
    attack: 1.15,
  },
  tribulation_body: {
    title: '雷劫淬体',
    name: '劫雷化身',
    hp: 2.4,
    attack: 1.2,
  },
  inner_demon_grand: {
    title: '大执念劫',
    name: '执念化身',
    hp: 1.1,
    attack: 1.1,
  },
  heavenly_tribulation_final: {
    title: '天劫前奏',
    name: '天道劫影',
    hp: 2.6,
    attack: 1.25,
  },
} as const satisfies Record<BreakthroughChallengeId, { title: string; name: string; hp: number; attack: number }>;
