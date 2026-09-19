// Immutable tower v5 definitions. Changes require a new content version.
import type { SkillDef, StatusDef } from '../core';
export const TOWER_STATUS_DEFS: StatusDef[] = [
  {
    id: 'tower.mirror-anchor',
    name: '镜阵核心',
    kind: 'tower.mirror-anchor',
    untilBattleEnd: true,
    dispellable: false,
    extendable: false,
  },
  {
    id: 'tower.mirror-cover',
    name: '镜侍护主',
    kind: 'tower.mirror-cover',
    category: 'buff',
    maxStacks: 2,
    expireSameRound: true,
    dispellable: false,
    extendable: false,
  },
  {
    id: 'tower.fury',
    name: '碎梦',
    kind: 'tower.fury',
    category: 'buff',
    untilBattleEnd: true,
    damageDealtPhysical: 1.15,
    damageDealtSpell: 1.15,
  },
  {
    id: 'tower.exposed',
    name: '破绽',
    kind: 'tower.exposed',
    category: 'debuff',
    damageTakenPhysical: 1.25,
    damageTakenSpell: 1.25,
  },
  {
    id: 'tower.bound',
    name: '缚梦',
    kind: 'tower.bound',
    category: 'control',
    blocksSpell: true,
    blocksPhysical: true,
  },
];
export const TOWER_SKILLS: SkillDef[] = [
  {
    id: 'tower.mirror-master',
    name: '镜阵',
    tags: ['passive'],
    targeting: { side: 'self' },
    effects: [],
    innate: {
      entryStatus: {
        statusId: 'tower.mirror-anchor',
        minDuration: 1,
        maxDuration: 1,
      },
    },
    hooks: [
      {
        on: 'onHitCalc',
        targetIsSelf: true,
        when: { targetStatusStack: { statusId: 'tower.mirror-cover', min: 1 } },
        effects: [
          { type: 'modifyStrike', factor: '1 - 0.15 * targetStatusStacks' },
        ],
      },
    ],
  },
  {
    id: 'tower.mirror-guard',
    name: '镜侍护主',
    tags: ['passive'],
    targeting: { side: 'self' },
    effects: [],
    hooks: [
      {
        on: 'onRoundStart',
        when: { sourceStanding: true },
        targeting: {
          side: 'ally',
          mode: 'all',
          count: 1,
          requireStatusIds: ['tower.mirror-anchor'],
        },
        effects: [
          {
            type: 'applyStatus',
            statusId: 'tower.mirror-cover',
            duration: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'tower.support-strike',
    name: '幻影轻击',
    tags: ['physical'],
    targeting: { side: 'enemy', count: 1 },
    effects: [{ type: 'physicalHit', coeff: 1, resultFactors: [0.25] }],
  },
  {
    id: 'tower.last-stand',
    name: '碎梦',
    tags: ['passive'],
    targeting: { side: 'self' },
    effects: [],
    hooks: [
      {
        on: 'onRoundStart',
        aim: 'self',
        when: {
          sourceHpRatioBelow: 0.4,
          sourceStanding: true,
          oncePerBattle: true,
        },
        effects: [
          {
            type: 'applyStatus',
            statusId: 'tower.fury',
            duration: 1,
            self: true,
          },
        ],
      },
    ],
  },
  {
    id: 'tower.strike',
    name: '裂影斩',
    tags: ['physical'],
    targeting: { side: 'enemy', count: 1 },
    effects: [{ type: 'physicalHit', coeff: 1.15 }],
  },
  {
    id: 'tower.double',
    name: '叠浪双斩',
    tags: ['physical'],
    targeting: { side: 'enemy', count: 1 },
    effects: [{ type: 'physicalHit', hits: 2, coeff: 0.72 }],
  },
  {
    id: 'tower.charge',
    name: '蓄势',
    tags: ['support'],
    targeting: { side: 'self' },
    effects: [
      { type: 'emitMechanic', mechanicId: 'tower.charge', name: '蓄势' },
    ],
  },
  {
    id: 'tower.heavy',
    name: '负碑重击',
    tags: ['physical'],
    targeting: { side: 'enemy', count: 1 },
    effects: [
      { type: 'physicalHit', coeff: 1.8 },
      {
        type: 'applyStatus',
        statusId: 'tower.exposed',
        duration: 1,
        self: true,
      },
    ],
  },
  {
    id: 'tower.bolt',
    name: '碎镜灵光',
    tags: ['spell'],
    costMp: 8,
    targeting: { side: 'enemy', count: 1 },
    effects: [{ type: 'spellHit', coeff: 1, power: 30 }],
  },
  {
    id: 'tower.wave',
    name: '照影潮',
    tags: ['spell'],
    costMp: 18,
    targeting: { side: 'enemy', mode: 'fill', count: 2 },
    effects: [
      { type: 'spellHit', coeff: 0.7, power: 30 },
      {
        type: 'applyStatus',
        statusId: 'tower.exposed',
        duration: 1,
        self: true,
      },
    ],
  },
  {
    id: 'tower.seal',
    name: '缚梦咒',
    tags: ['spell', 'seal'],
    costMp: 15,
    sealBase: 55,
    targeting: { side: 'enemy', count: 1 },
    effects: [
      {
        type: 'applyStatus',
        statusId: 'tower.bound',
        duration: 1,
        hit: 'seal',
      },
    ],
  },
  {
    id: 'tower.heal',
    name: '续灯',
    tags: ['spell', 'support'],
    costMp: 12,
    targeting: { side: 'ally', mode: 'lowestHp', count: 1 },
    effects: [{ type: 'heal', power: 'source.maxHp * 0.2', fixedBase: true }],
  },
];
