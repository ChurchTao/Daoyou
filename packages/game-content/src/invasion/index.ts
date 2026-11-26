import type { SkillDef, StatusDef } from '@daoyou/combat-core/types';
import {
  INVASION_CARDS,
  INVASION_CARD_COPY,
} from '@daoyou/game-domain/invasion';

/** 整阵气血相对于同境界普通除祟首战的倍数。 */
export const INVASION_HP_BUDGET_BY_PARTY_SIZE: Readonly<
  Partial<Record<number, number>>
> = { 2: 1.65, 3: 3.5, 4: 5.8 };

export const INVASION_SKILLS: SkillDef[] = [
  {
    id: 'invasion.borrow',
    name: '借甲',
    tags: ['support'],
    targeting: { side: 'ally' },
    effects: [
      { type: 'applyStatus', statusId: 'invasion.borrow', duration: 2 },
    ],
  },
  {
    id: 'invasion.warning',
    name: '裂阵蓄势·下回合冲击',
    tags: ['support'],
    targeting: { side: 'self' },
    effects: [
      {
        type: 'applyStatus',
        statusId: 'invasion.warning',
        duration: 2,
        self: true,
      },
    ],
  },
  {
    id: 'invasion.rift',
    name: '裂阵冲击',
    tags: ['spell'],
    targeting: { side: 'enemy', mode: 'all', count: 8 },
    effects: [
      { type: 'spellHit', coeff: 1.4, power: 'level * 1.4' },
      {
        type: 'removeStatus',
        statusIds: ['invasion.warning'],
        targeting: { side: 'self' },
      },
      {
        type: 'applyStatus',
        statusId: 'invasion.unleashed',
        duration: 999,
        self: true,
      },
    ],
  },
  {
    id: 'invasion.slow',
    name: '缚足',
    tags: ['spell'],
    targeting: { side: 'enemy' },
    effects: [
      { type: 'spellHit', coeff: 0.7 },
      { type: 'applyStatus', statusId: 'invasion.slow', duration: 2 },
    ],
  },
  {
    id: 'invasion.armor',
    name: '裂甲',
    tags: ['physical'],
    targeting: { side: 'enemy' },
    effects: [
      { type: 'physicalHit', coeff: 0.8, defenseIgnore: 0.25 },
      { type: 'applyStatus', statusId: 'invasion.armor', duration: 2 },
    ],
  },
  ...INVASION_CARDS.map((card): SkillDef => ({
    id: `invasion.card.${card}`,
    name: INVASION_CARD_COPY[card].name,
    tags: ['passive'],
    targeting: { side: 'self' },
    effects: [],
    ...(card === 'focus'
      ? { innate: { mpCostFactor: 0.8 } }
      : {
          hooks: [
            {
              on: 'onRoundStart',
              aim: 'self',
              when: { sourceStanding: true, oncePerBattle: true },
              effects:
                card === 'shield'
                  ? [
                      {
                        type: 'applyBarrier',
                        id: 'invasion.card.shield',
                        kind: 'shield',
                        name: '护心',
                        power: 'maxHp * 0.18',
                        duration: 3,
                      },
                    ]
                  : [
                      {
                        type: 'applyStatus',
                        statusId: `invasion.card.${card}`,
                        duration: 999,
                        self: true,
                      },
                    ],
            },
          ],
        }),
  })),
];

export const INVASION_STATUSES: StatusDef[] = [
  {
    id: 'invasion.borrow',
    name: '借甲·护法分担伤势',
    kind: 'invasion.borrow',
    category: 'buff',
    sourceBound: true,
    redirectTaken: { keep: 0.75, toCaster: 0.25 },
  },
  {
    id: 'invasion.warning',
    name: '裂阵蓄势',
    kind: 'invasion.warning',
    category: 'buff',
    dispellable: false,
  },
  {
    id: 'invasion.unleashed',
    name: '裂阵已施放',
    kind: 'invasion.unleashed',
    category: 'buff',
    dispellable: false,
  },
  {
    id: 'invasion.slow',
    name: '缚足',
    kind: 'invasion.slow',
    category: 'debuff',
    speedMod: '-floor(target.speed * 0.15)',
  },
  {
    id: 'invasion.armor',
    name: '裂甲',
    kind: 'invasion.armor',
    category: 'debuff',
    damageTakenPhysical: 1.13,
  },
  {
    id: 'invasion.card.assault',
    name: '破军',
    kind: 'invasion.card.assault',
    category: 'buff',
    dispellable: false,
    damageDealtPhysical: 1.12,
    damageDealtSpell: 1.12,
  },
  {
    id: 'invasion.card.guard',
    name: '镇岳',
    kind: 'invasion.card.guard',
    category: 'buff',
    dispellable: false,
    damageTakenPhysical: 0.88,
    damageTakenSpell: 0.88,
  },
  {
    id: 'invasion.card.healing',
    name: '回春',
    kind: 'invasion.card.healing',
    category: 'buff',
    dispellable: false,
    healDealt: 1.2,
  },
];

export const INVASION_FORMATIONS = [
  ['索命古魔', '回元魔侍', '借甲魔卫', '裂甲魔卒', '缚足魔卒'],
  ['蚀灵魔君', '回元魔侍', '借甲魔卫', '缚足魔卒', '噬法魔卒'],
  ['焚阵天魔', '回元魔侍', '借甲魔卫', '焚魂魔卒', '裂甲魔卒'],
] as const;
