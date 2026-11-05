// 除祟敌人的 V6 技能与状态。全部用现有引擎能力，引擎不识别除祟。
import type { SkillDef, StatusDef } from '@daoyou/combat-core/types';
import { EXORCISM_ENCOUNTER_PACK as pack } from './encounter-pack.js';

const { corrosion, taint } = pack;

export const EXORCISM_STATUS_DEFS: StatusDef[] = [
  {
    id: 'exorcism.taint',
    name: '祟气',
    description: '祟主身边祟气弥漫，受到的治疗降低。',
    kind: 'exorcism.taint',
    category: 'debuff',
    healTaken: taint.healTaken,
    dispellable: false,
    extendable: false,
  },
  {
    id: 'exorcism.corrosion.mark',
    name: '祟蚀',
    description: '祟气入体，受到的治疗减半。',
    kind: 'exorcism.corrosion.mark',
    category: 'debuff',
    healTaken: corrosion.healTaken,
    dispellable: false,
    extendable: false,
  },
  {
    id: 'exorcism.sap',
    name: '藤刺',
    description: '每回合结束损失气血。',
    kind: 'exorcism.sap',
    category: 'dot',
    ticks: 'roundEnd',
    onTick: { type: 'dot', ratioOfMaxHp: 0.02 },
  },
  {
    id: 'exorcism.parasite',
    name: '寄生',
    description: '每回合结束损失气血，受到的治疗降低，可叠三层。',
    kind: 'exorcism.parasite',
    category: 'dot',
    ticks: 'roundEnd',
    onTick: { type: 'dot', ratioOfMaxHp: 0.03 },
    healTaken: 0.75,
    maxStacks: 3,
  },
  {
    id: 'exorcism.exposed',
    name: '破绽',
    description: '重击之后露出破绽，受到的物理与法术伤害提高。',
    kind: 'exorcism.exposed',
    category: 'debuff',
    damageTakenPhysical: 1.5,
    damageTakenSpell: 1.5,
  },
  {
    id: 'exorcism.soul-wound',
    name: '灵损',
    description: '法力被噬，受到的法术伤害提高，可叠四层。',
    kind: 'exorcism.soul-wound',
    category: 'debuff',
    damageTakenSpell: 1.15,
    maxStacks: 4,
  },
  {
    id: 'exorcism.mirror-anchor',
    name: '镜阵核心',
    kind: 'exorcism.mirror-anchor',
    untilBattleEnd: true,
    dispellable: false,
    extendable: false,
  },
  {
    id: 'exorcism.mirror-cover',
    name: '镜侍护主',
    description: '每名镜侍提供减伤，镜侍倒下后减伤消失。',
    kind: 'exorcism.mirror-cover',
    category: 'buff',
    maxStacks: 2,
    expireSameRound: true,
    dispellable: false,
    extendable: false,
  },
  {
    id: 'exorcism.rot',
    name: '腐气',
    description: '受到的治疗减半，可叠两层。',
    kind: 'exorcism.rot',
    category: 'debuff',
    healTaken: 0.6,
    maxStacks: 2,
  },
  {
    id: 'exorcism.blood-rot',
    name: '血毒',
    description: '每回合结束损失气血，受到的治疗大减。',
    kind: 'exorcism.blood-rot',
    category: 'dot',
    ticks: 'roundEnd',
    onTick: { type: 'dot', ratioOfMaxHp: 0.02 },
    healTaken: 0.4,
    dispellable: false,
  },
  {
    id: 'exorcism.tide.physical-ward',
    name: '退潮',
    description: '本回合受到的物理伤害大减。',
    kind: 'exorcism.tide',
    category: 'buff',
    damageTakenPhysical: 0.6,
    expireSameRound: true,
    dispellable: false,
    extendable: false,
  },
  {
    id: 'exorcism.tide.spell-ward',
    name: '涨潮',
    description: '本回合受到的法术伤害大减。',
    kind: 'exorcism.tide',
    category: 'buff',
    damageTakenSpell: 0.6,
    expireSameRound: true,
    dispellable: false,
    extendable: false,
  },
  {
    id: 'exorcism.bound',
    name: '缚梦',
    description: '术法被封住，普攻、物理技能和防御仍可使用。',
    kind: 'exorcism.bound',
    category: 'control',
    isSeal: true,
    blocksSpell: true,
  },
  {
    id: 'exorcism.faded',
    name: '隐去身形',
    description: '本回合无法被选为目标。',
    kind: 'exorcism.faded',
    category: 'buff',
    untargetable: true,
    expireSameRound: true,
    dispellable: false,
    extendable: false,
  },
  {
    id: 'exorcism.mountain-rage',
    name: '暴怒',
    description: '小妖死后暴怒，造成的伤害提高。',
    kind: 'exorcism.mountain-rage',
    category: 'buff',
    untilBattleEnd: true,
    damageDealtPhysical: 1.3,
    damageDealtSpell: 1.3,
    dispellable: false,
  },
  {
    id: 'exorcism.debt',
    name: '收债',
    description: '借来的力量要还：每回合结束损失气血，受到的治疗减半。',
    kind: 'exorcism.debt',
    category: 'debuff',
    ticks: 'roundEnd',
    onTick: { type: 'dot', ratioOfMaxHp: 0.08 },
    healTaken: 0.5,
    dispellable: false,
    extendable: false,
  },
  {
    id: 'exorcism.borrowed',
    name: '借力',
    description: '造成的伤害提高；到期后开始收债。',
    kind: 'exorcism.borrowed',
    category: 'buff',
    damageDealtPhysical: 1.25,
    damageDealtSpell: 1.25,
    dispellable: false,
    extendable: false,
    onExpire: { statusId: 'exorcism.debt', duration: 30 },
  },
  {
    id: 'exorcism.debt-lite',
    name: '收债',
    description: '每回合结束损失气血。',
    kind: 'exorcism.debt',
    category: 'debuff',
    ticks: 'roundEnd',
    onTick: { type: 'dot', ratioOfMaxHp: 0.04 },
    dispellable: false,
    extendable: false,
  },
  {
    id: 'exorcism.borrowed-lite',
    name: '借力',
    description: '造成的伤害提高；到期后开始收债。',
    kind: 'exorcism.borrowed',
    category: 'buff',
    damageDealtPhysical: 1.15,
    damageDealtSpell: 1.15,
    dispellable: false,
    extendable: false,
    onExpire: { statusId: 'exorcism.debt-lite', duration: 30 },
  },
];

export const EXORCISM_SKILLS: SkillDef[] = [
  {
    id: 'exorcism.taint-aura',
    name: '祟气弥漫',
    tags: ['passive'],
    targeting: { side: 'self' },
    effects: [],
    hooks: [
      {
        on: 'onRoundStart',
        when: { sourceStanding: true },
        targeting: { side: 'enemy', mode: 'all', count: 8 },
        effects: [
          { type: 'applyStatus', statusId: 'exorcism.taint', duration: 1 },
        ],
      },
    ],
  },
  // 腐气：减疗的普通攻击
  {
    id: 'exorcism.rot.claw',
    name: '腐爪',
    tags: ['physical'],
    targeting: { side: 'enemy', count: 1 },
    effects: [
      { type: 'physicalHit', coeff: 0.9 },
      { type: 'applyStatus', statusId: 'exorcism.rot', duration: 3 },
    ],
  },
  {
    id: 'exorcism.rot.mist',
    name: '腐骨瘴',
    tags: ['spell'],
    costMp: 8,
    targeting: { side: 'enemy', count: 1 },
    effects: [
      { type: 'spellHit', coeff: 0.85, power: 30 },
      { type: 'applyStatus', statusId: 'exorcism.rot', duration: 3 },
    ],
  },
  // 血河妖蟒
  {
    id: 'exorcism.python.bite',
    name: '血牙',
    tags: ['physical'],
    targeting: { side: 'enemy', count: 1 },
    effects: [
      { type: 'physicalHit', coeff: 1 },
      { type: 'applyStatus', statusId: 'exorcism.blood-rot', duration: 4 },
    ],
  },
  // 潮汐蛟影
  {
    id: 'exorcism.tide.cycle',
    name: '潮汐',
    tags: ['passive'],
    targeting: { side: 'self' },
    effects: [],
    hooks: [
      {
        on: 'onRoundStart',
        aim: 'self',
        when: {
          sourceStanding: true,
          expression: 'round - floor(round / 2) * 2 == 1',
        },
        effects: [
          {
            type: 'applyStatus',
            statusId: 'exorcism.tide.physical-ward',
            duration: 1,
            self: true,
          },
        ],
      },
      {
        on: 'onRoundStart',
        aim: 'self',
        when: {
          sourceStanding: true,
          expression: 'round - floor(round / 2) * 2 == 0',
        },
        effects: [
          {
            type: 'applyStatus',
            statusId: 'exorcism.tide.spell-ward',
            duration: 1,
            self: true,
          },
        ],
      },
    ],
  },
  {
    id: 'exorcism.tide.surge',
    name: '翻浪',
    tags: ['physical'],
    targeting: { side: 'enemy', count: 1 },
    effects: [{ type: 'physicalHit', coeff: 1.2 }],
  },
  // 金身尸王
  {
    id: 'exorcism.corpse.rise',
    name: '尸变再起',
    tags: ['passive'],
    targeting: { side: 'self' },
    effects: [],
    hooks: [
      {
        on: 'onFatal',
        targetIsSelf: true,
        aim: 'self',
        when: { oncePerBattle: true },
        effects: [
          { type: 'restoreHp', power: 'maxHp * 0.25', allowFatal: true },
        ],
      },
    ],
  },
  // 噬灵邪修
  {
    id: 'exorcism.heretic.heal',
    name: '噬灵回元',
    tags: ['support'],
    targeting: { side: 'ally', mode: 'lowestHp', count: 1 },
    effects: [{ type: 'heal', power: 'target.maxHp * 0.12', fixedBase: true }],
  },
  {
    id: 'exorcism.heretic.heal-lite',
    name: '回元',
    tags: ['support'],
    targeting: { side: 'ally', mode: 'lowestHp', count: 1 },
    effects: [{ type: 'heal', power: 'target.maxHp * 0.08', fixedBase: true }],
  },
  // 缚梦幻师
  {
    id: 'exorcism.binder.seal',
    name: '缚梦咒',
    tags: ['spell', 'seal'],
    costMp: 15,
    sealBase: 55,
    targeting: { side: 'enemy', count: 1 },
    effects: [
      {
        type: 'applyStatus',
        statusId: 'exorcism.bound',
        duration: 1,
        hit: 'seal',
      },
    ],
  },
  // 铜傀镇守
  {
    id: 'exorcism.bronze.recoil',
    name: '反震',
    tags: ['passive'],
    targeting: { side: 'self' },
    effects: [],
    hooks: [
      {
        on: 'onBeHit',
        targetIsSelf: true,
        sourceIsEnemy: true,
        requireKind: 'physical',
        retaliation: true,
        aim: 'hookSource',
        when: { damageOrigins: ['action-direct'] },
        effects: [{ type: 'physicalHit', coeff: 0.18 }],
      },
    ],
  },
  {
    id: 'exorcism.bronze.recoil-lite',
    name: '反震',
    tags: ['passive'],
    targeting: { side: 'self' },
    effects: [],
    hooks: [
      {
        on: 'onBeHit',
        targetIsSelf: true,
        sourceIsEnemy: true,
        requireKind: 'physical',
        retaliation: true,
        aim: 'hookSource',
        when: { damageOrigins: ['action-direct'] },
        effects: [{ type: 'physicalHit', coeff: 0.12 }],
      },
    ],
  },
  // 残魂守试者
  {
    id: 'exorcism.soul.fade',
    name: '隐去身形',
    tags: ['support'],
    targeting: { side: 'self' },
    effects: [
      {
        type: 'applyStatus',
        statusId: 'exorcism.faded',
        duration: 1,
        self: true,
      },
    ],
  },
  {
    id: 'exorcism.soul.strike',
    name: '残魂一击',
    tags: ['spell'],
    costMp: 12,
    targeting: { side: 'enemy', count: 1 },
    effects: [{ type: 'spellHit', coeff: 1.5, power: 30 }],
  },
  // 山魈王
  {
    id: 'exorcism.mountain.rage',
    name: '山魈暴怒',
    tags: ['passive'],
    targeting: { side: 'self' },
    effects: [],
    hooks: [
      {
        on: 'onDeath',
        aim: 'self',
        when: { sourceStanding: true, targetOtherAlly: true },
        effects: [
          {
            type: 'applyStatus',
            statusId: 'exorcism.mountain-rage',
            duration: 1,
            self: true,
          },
        ],
      },
    ],
  },
  // 血契掮客
  {
    id: 'exorcism.broker.contract',
    name: '血契',
    tags: ['support'],
    targeting: { side: 'enemy', count: 1 },
    effects: [
      { type: 'applyStatus', statusId: 'exorcism.borrowed', duration: 3 },
    ],
  },
  {
    id: 'exorcism.broker.contract-lite',
    name: '血契',
    tags: ['support'],
    targeting: { side: 'enemy', count: 1 },
    effects: [
      { type: 'applyStatus', statusId: 'exorcism.borrowed-lite', duration: 3 },
    ],
  },
  {
    id: 'exorcism.true-sight',
    name: '祟眼',
    tags: ['passive'],
    targeting: { side: 'self' },
    effects: [],
    innate: { revealStealth: true },
  },
  {
    id: 'exorcism.corrosion',
    name: '祟蚀',
    tags: ['passive'],
    targeting: { side: 'self' },
    effects: [],
    hooks: [
      {
        on: 'onRoundEnd',
        when: {
          sourceStanding: true,
          expression: `round >= ${corrosion.startRound}`,
        },
        targeting: { side: 'enemy', mode: 'all', count: 8 },
        effects: [
          {
            type: 'loseHp',
            power: `target.maxHp * (${corrosion.hpRatio} + ${corrosion.hpRatioPerRound} * (round - ${corrosion.startRound}))`,
          },
          {
            type: 'applyStatus',
            statusId: 'exorcism.corrosion.mark',
            duration: 2,
          },
        ],
      },
    ],
  },
  // 祟脉小怪
  {
    id: 'exorcism.grass.lash',
    name: '藤鞭',
    tags: ['physical'],
    targeting: { side: 'enemy', count: 1 },
    effects: [
      { type: 'physicalHit', coeff: 0.9 },
      { type: 'applyStatus', statusId: 'exorcism.sap', duration: 2 },
    ],
  },
  {
    id: 'exorcism.earth.slam',
    name: '岩击',
    tags: ['physical'],
    targeting: { side: 'enemy', count: 1 },
    effects: [{ type: 'physicalHit', coeff: 1.25 }],
  },
  {
    id: 'exorcism.water.bolt',
    name: '寒流',
    tags: ['spell'],
    costMp: 8,
    targeting: { side: 'enemy', count: 1 },
    effects: [{ type: 'spellHit', coeff: 1, power: 30 }],
  },
  {
    id: 'exorcism.demonic.drain',
    name: '噬气',
    tags: ['spell'],
    costMp: 8,
    targeting: { side: 'enemy', count: 1 },
    effects: [
      { type: 'spellHit', coeff: 0.85, power: 30 },
      { type: 'damageMp', power: 'target.maxMp * 0.05' },
    ],
  },
  {
    id: 'exorcism.corpse.claw',
    name: '尸爪',
    tags: ['physical'],
    targeting: { side: 'enemy', count: 1 },
    effects: [{ type: 'physicalHit', coeff: 1, defenseIgnore: 0.2 }],
  },
  // 枯藤老祟
  {
    id: 'exorcism.vine.parasite',
    name: '种下寄生',
    tags: ['spell'],
    costMp: 8,
    targeting: { side: 'enemy', count: 1 },
    effects: [
      { type: 'applyStatus', statusId: 'exorcism.parasite', duration: 3 },
    ],
  },
  {
    id: 'exorcism.vine.bloom',
    name: '枯荣',
    tags: ['spell'],
    costMp: 12,
    targeting: { side: 'enemy', count: 1 },
    effects: [
      { type: 'spellHit', coeff: 0.9, power: 30 },
      {
        type: 'loseHp',
        power: 'target.maxHp * 0.07 * targetStatusStacks',
        when: { targetStatusStack: { statusId: 'exorcism.parasite', min: 1 } },
      },
      { type: 'removeStatus', statusIds: ['exorcism.parasite'] },
    ],
  },
  // 断脉石魁
  {
    id: 'exorcism.vein.charge',
    name: '蓄势',
    tags: ['support'],
    targeting: { side: 'self' },
    effects: [
      { type: 'emitMechanic', mechanicId: 'exorcism.charge', name: '蓄势' },
    ],
  },
  {
    id: 'exorcism.vein.heavy',
    name: '断脉重击',
    tags: ['physical'],
    targeting: { side: 'enemy', count: 1 },
    effects: [
      { type: 'physicalHit', coeff: 2.6 },
      {
        type: 'applyStatus',
        statusId: 'exorcism.exposed',
        duration: 1,
        self: true,
      },
    ],
  },
  {
    id: 'exorcism.vein.heavy-lite',
    name: '岩傀重击',
    tags: ['physical'],
    targeting: { side: 'enemy', count: 1 },
    effects: [
      { type: 'physicalHit', coeff: 2 },
      {
        type: 'applyStatus',
        statusId: 'exorcism.exposed',
        duration: 1,
        self: true,
      },
    ],
  },
  // 噬灵魔影
  {
    id: 'exorcism.shadow.burn',
    name: '噬灵',
    tags: ['spell'],
    costMp: 8,
    targeting: { side: 'enemy', count: 1 },
    effects: [
      { type: 'spellHit', coeff: 0.95, power: 30 },
      { type: 'damageMp', power: 'target.maxMp * 0.18' },
      { type: 'applyStatus', statusId: 'exorcism.soul-wound', duration: 3 },
    ],
  },
  {
    id: 'exorcism.shadow.burn-lite',
    name: '吸灵',
    tags: ['spell'],
    costMp: 8,
    targeting: { side: 'enemy', count: 1 },
    effects: [
      { type: 'spellHit', coeff: 0.7, power: 30 },
      { type: 'damageMp', power: 'target.maxMp * 0.1' },
      { type: 'applyStatus', statusId: 'exorcism.soul-wound', duration: 2 },
    ],
  },
  // 镜阵尊主
  {
    id: 'exorcism.mirror.master',
    name: '镜阵',
    tags: ['passive'],
    targeting: { side: 'self' },
    effects: [],
    innate: {
      entryStatus: {
        statusId: 'exorcism.mirror-anchor',
        minDuration: 1,
        maxDuration: 1,
      },
    },
    hooks: [
      {
        on: 'onHitCalc',
        targetIsSelf: true,
        when: {
          targetStatusStack: { statusId: 'exorcism.mirror-cover', min: 1 },
        },
        effects: [
          { type: 'modifyStrike', factor: '1 - 0.3 * targetStatusStacks' },
        ],
      },
    ],
  },
  {
    id: 'exorcism.mirror.guard',
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
          requireStatusIds: ['exorcism.mirror-anchor'],
        },
        effects: [
          {
            type: 'applyStatus',
            statusId: 'exorcism.mirror-cover',
            duration: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'exorcism.mirror.strike',
    name: '裂影斩',
    tags: ['physical'],
    targeting: { side: 'enemy', count: 1 },
    effects: [{ type: 'physicalHit', coeff: 1.15 }],
  },
  {
    id: 'exorcism.mirror.double',
    name: '叠浪双斩',
    tags: ['physical'],
    targeting: { side: 'enemy', count: 1 },
    effects: [{ type: 'physicalHit', hits: 2, coeff: 0.72 }],
  },
  {
    id: 'exorcism.mirror.light',
    name: '幻影轻击',
    tags: ['physical'],
    targeting: { side: 'enemy', count: 1 },
    effects: [{ type: 'physicalHit', coeff: 1, resultFactors: [0.25] }],
  },
];
