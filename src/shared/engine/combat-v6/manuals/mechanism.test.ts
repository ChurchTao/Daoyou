import { describe, expect, it } from 'vitest';
import { JIUJIE_COMBAT } from '../content/jiujie-pack';
import {
  CommandType,
  DamageOrigin,
  EffectType,
  HookName,
  SkillTag,
  TargetSide,
  createBattle,
  type SkillDef,
  type StatusDef,
} from '../core';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_1_VERSIONS } from '../version';
import { compileCharacterManualsV1, manualSlot } from './compiler';
import { CHARACTER_MANUALS_V1, MANUAL_PACK } from './content';
import { compileManualSkill, manualMechanismValue } from './mechanism';
import { loadManualPack } from './pack';
import { manualEffectLines } from './presentation';

const statuses: StatusDef[] = [
  { id: 'dot', name: '毒', kind: 'dot', category: 'dot' },
  { id: 'debuff', name: '减益', kind: 'debuff', category: 'debuff' },
  {
    id: 'control',
    name: '封法',
    kind: 'control',
    category: 'control',
    blocksSpell: true,
  },
  {
    id: 'revive',
    name: '锢魂',
    kind: 'revive',
    category: 'control',
    blocksRevive: true,
  },
  {
    id: 'locked',
    name: '不可驱散',
    kind: 'locked',
    category: 'control',
    dispellable: false,
  },
];
const attack: SkillDef = {
  id: 'strike',
  name: '打击',
  tags: [SkillTag.Physical],
  targeting: { side: TargetSide.Enemy },
  effects: [{ type: EffectType.PhysicalHit }],
};
function setup(ids: string[], level = 9, skill = attack) {
  const passives = ids.map((id) =>
    compileManualSkill(
      CHARACTER_MANUALS_V1.find((m) => m.id === `character_manual.${id}`)!,
      level,
    ),
  );
  const session = createBattle({
    seed: 42,
    versions: COMBAT_V6_PHASE_1_VERSIONS,
    ruleset: createDaoyouRuleset({
      formulas: {
        baseDamage: () => 1000,
        physicalHitChance: () => 1,
        spellHitChance: () => 1,
        fluctuationMin: 1,
        fluctuationMax: 1,
        defendPhysicalFactor: 1,
      },
    }),
    skills: [skill, ...passives],
    statusDefs: statuses,
    units: [
      {
        id: 'a',
        name: 'a',
        side: 0,
        kind: 'player',
        skills: [skill.id],
        passives: passives.map((s) => s.id),
        attrs: {
          hp: 10000,
          maxHp: 10000,
          mp: 1000,
          maxMp: 1000,
          speed: 20,
          physicalAtk: 100,
          physicalDef: 0,
          critRate: 0,
          spellCritRate: 0,
        },
      },
      {
        id: 'b',
        name: 'b',
        side: 1,
        kind: 'npc',
        attrs: {
          hp: 10000,
          maxHp: 10000,
          speed: 10,
          physicalAtk: 1,
          physicalDef: 0,
          critRate: 0,
        },
      },
    ],
  });
  return session;
}
function status(session: ReturnType<typeof setup>, id: string, unitId = 'a') {
  const def = statuses.find((s) => s.id === id)!;
  session.unit(unitId).statuses.push({
    id,
    kind: def.kind,
    sourceId: 'b',
    remainingRounds: 2,
    appliedRound: 0,
    speedMod: 0,
    attrMods: {},
    damageTakenPhysical: 1,
    damageTakenSpell: 1,
    healTaken: 1,
    healDealt: 1,
    stacks: 1,
  });
}
function barrier(
  session: ReturnType<typeof setup>,
  unitId = 'a',
  amount = 100,
) {
  session.unit(unitId).barriers.push({
    id: 'shield',
    kind: 'shield',
    name: '盾',
    current: amount,
    remainingRounds: 2,
    sourceId: 'a',
    appliedRound: 0,
  });
}
function strike(
  session: ReturnType<typeof setup>,
  kind: 'physical' | 'spell' | 'fixed',
  defense = false,
  extra = {},
) {
  return session.hooks.emit(HookName.OnHitCalc, {
    source: session.unit(defense ? 'b' : 'a'),
    target: session.unit(defense ? 'a' : 'b'),
    kind,
    damage: 1000,
    origin: DamageOrigin.ActionDirect,
    skillId: attack.id,
    isPrimary: true,
    ...extra,
  }).damage!;
}

describe('首版功法内容合同', () => {
  it('24本各六种，六维与机制逐层成长且无品质/产出字段', () => {
    for (const realm of ['炼气', '筑基', '金丹', '元婴'])
      expect(
        CHARACTER_MANUALS_V1.filter((m) => m.realm === realm),
      ).toHaveLength(6);
    for (const manual of CHARACTER_MANUALS_V1) {
      expect(manual).not.toHaveProperty('rarity');
      expect(manual).not.toHaveProperty('dropWeight');
      expect(manual.effects).toHaveLength(1);
      for (let level = 1; level <= 9; level++) {
        const result = compileCharacterManualsV1({
          realm: '元婴',
          state: {
            version: 1,
            revision: 0,
            learned: [
              {
                manualId: manual.id,
                level,
                unlockedLevel: level <= 3 ? 3 : level <= 6 ? 6 : 9,
              },
            ],
            build: {
              slots: [{ slot: manualSlot(manual), manualId: manual.id }],
            },
          },
        });
        expect(result.ok).toBe(true);
        if (!result.ok) continue;
        expect(
          result.projection.attributeBonuses[manual.effects[0].attribute],
        ).toBe(
          manual.effects[0].valueAt1 +
            (level - 1) * manual.effects[0].valuePerLevel,
        );
        expect(manualEffectLines(manual, level)).toHaveLength(2);
        expect(manualMechanismValue(manual.mechanism, level)).toBeGreaterThan(
          level === 1 ? 0 : manualMechanismValue(manual.mechanism, level - 1),
        );
      }
    }
  });
  it('拒绝旧稀有度字段和倒退成长', () => {
    expect(() =>
      loadManualPack({
        ...MANUAL_PACK,
        manuals: [{ ...MANUAL_PACK.manuals[0], rarity: 'rare' }],
      }),
    ).toThrow();
    const data = structuredClone(MANUAL_PACK);
    data.manuals[0].mechanism.valueAt9 = 0.0001;
    expect(() => loadManualPack(data)).toThrow();
  });
  it('拒绝不成长的机制与回合恢复的目标条件', () => {
    const data = structuredClone(MANUAL_PACK);
    data.manuals[0].mechanism.valueAt9 = data.manuals[0].mechanism.valueAt1;
    expect(() => loadManualPack(data)).toThrow();
    data.manuals[0].mechanism.valueAt9 = 0.01;
    data.manuals[0].mechanism.condition = 'targetHpBelow50';
    expect(() => loadManualPack(data)).toThrow();
  });
  it('大衍的每层概率差值保留小数面板点数', () => {
    const result = compileCharacterManualsV1({
      realm: '筑基',
      state: {
        version: 1,
        revision: 0,
        learned: [
          { manualId: 'character_manual.dayan', level: 2, unlockedLevel: 3 },
        ],
        build: { slots: [{ slot: 2, manualId: 'character_manual.dayan' }] },
      },
    });
    expect(result.ok && result.projection.panel).toEqual([
      { attr: 'sealResist', mode: 'add', value: 2.5 },
    ]);
  });
});

describe('单条件机制结算', () => {
  it.each([
    ['gengjin', 1030],
    ['qingyuan', 1040],
  ] as const)(
    '%s只强化主目标直接攻击，排除派生、比例扣血及器诀',
    (id, damage) => {
      const s = setup([id]);
      expect(strike(s, 'physical')).toBeCloseTo(damage);
      expect(strike(s, 'physical', false, { isPrimary: false })).toBe(1000);
      expect(
        strike(s, 'physical', false, { origin: DamageOrigin.HookDerived }),
      ).toBe(1000);
      expect(strike(s, 'physical', false, { percentageDamage: true })).toBe(
        1000,
      );
      const art = setup([id], 9, {
        ...attack,
        tags: [SkillTag.Physical, SkillTag.Art],
      });
      expect(strike(art, 'physical')).toBe(1000);
    },
  );
  it('血量阈值严格，多段跨过70%后停止增伤', () => {
    const s = setup(['gengjin'], 9, {
      ...attack,
      effects: [{ type: EffectType.PhysicalHit, hits: 2 }],
    });
    s.unit('b').attrs.hp = 7500;
    s.submit('a', {
      type: CommandType.Skill,
      skillId: attack.id,
      targets: ['b'],
    });
    s.submit('b', { type: CommandType.Defend });
    s.lockAndResolve();
    expect(s.unit('b').attrs.hp).toBe(5470);
    const exact = setup(['gengjin']);
    exact.unit('b').attrs.hp = 7000;
    expect(strike(exact, 'physical')).toBe(1000);
  });
  it.each(['shayao', 'liuji', 'yousha'])('%s只在对应残血条件增伤', (id) => {
    const s = setup([id]);
    expect(strike(s, 'physical')).toBe(1000);
    s.unit(id === 'yousha' ? 'b' : 'a').attrs.hp = 3500;
    expect(strike(s, 'physical')).toBe(1000);
    s.unit(id === 'yousha' ? 'b' : 'a').attrs.hp = 3499;
    expect(strike(s, 'physical')).toBeCloseTo(id === 'shayao' ? 1040 : 1060);
    expect(strike(s, 'fixed')).toBeCloseTo(
      id === 'liuji' ? 1000 : id === 'shayao' ? 1040 : 1060,
    );
  });
  it('法力条件与法术加成区分气血和法力', () => {
    const s = setup(['sanzhuan', 'chiyan', 'taiyang']);
    expect(strike(s, 'spell')).toBeCloseTo(1000 * 1.04 * 1.03 * 1.06);
    s.unit('a').attrs.mp = 700;
    expect(strike(s, 'spell')).toBeCloseTo(1000 * 1.03 * 1.06);
    s.unit('a').attrs.hp = 7000;
    expect(strike(s, 'spell')).toBe(1000);
  });
  it('有效护盾与防御条件，零盾不触发', () => {
    const s = setup(['guiyuan', 'houtu_jue', 'taibai']);
    expect(strike(s, 'physical', true)).toBe(1000);
    barrier(s, 'a');
    barrier(s, 'b');
    expect(strike(s, 'physical', true)).toBeCloseTo(940);
    expect(strike(s, 'physical')).toBeCloseTo(1060);
    s.unit('a').flags.defending = true;
    expect(strike(s, 'physical', true)).toBeCloseTo(940 * 0.91);
    s.unit('b').barriers[0].current = 0;
    expect(strike(s, 'physical')).toBe(1000);
  });
  it('玄阴不强化持续伤害，减益与持续伤害不能混用', () => {
    const s = setup(['xuanyin']);
    status(s, 'debuff', 'b');
    expect(strike(s, 'fixed')).toBe(1000);
    status(s, 'dot', 'b');
    expect(strike(s, 'fixed')).toBeCloseTo(1060);
    expect(strike(s, 'spell')).toBeCloseTo(1060);
    expect(strike(s, 'physical')).toBe(1000);
    expect(strike(s, 'fixed', false, { origin: DamageOrigin.Status })).toBe(
      1000,
    );
  });
  it('托天、元磁、明王和浩然分别识别条件', () => {
    const s = setup(['tuotian', 'yuanci', 'mingwang', 'haoran']);
    expect(strike(s, 'physical', true)).toBe(1000);
    expect(strike(s, 'spell', true)).toBeCloseTo(930);
    s.unit('a').attrs.mp = 500;
    expect(strike(s, 'spell', true)).toBe(1000);
    s.unit('a').attrs.hp = 4999;
    expect(strike(s, 'physical', true)).toBeCloseTo(930);
    status(s, 'revive');
    status(s, 'locked');
    expect(strike(s, 'spell', true)).toBe(1000);
    status(s, 'control');
    expect(strike(s, 'spell', true)).toBeCloseTo(900);
    status(s, 'debuff');
    expect(strike(s, 'spell', true)).toBeCloseTo(810);
  });
  it('幻灵/千浪为概率差额，千浪只在半血以下生效', () => {
    const s = setup(['huanling', 'qianlang']);
    const roll = () =>
      s.hooks.emit(HookName.OnHitRoll, {
        source: s.unit('b'),
        target: s.unit('a'),
        chance: 0.95,
        kind: 'physical',
        origin: DamageOrigin.ActionDirect,
      }).chance;
    expect(roll()).toBeCloseTo(0.92);
    s.unit('a').attrs.hp = 4999;
    expect(roll()).toBeCloseTo(0.86);
  });
  it('治疗/护盾只增强低血主目标，不增强派生恢复', () => {
    const s = setup(['qingmu', 'yudan', 'tianluo']);
    s.unit('b').attrs.hp = 4999;
    const base = {
      source: s.unit('a'),
      target: s.unit('b'),
      skillId: attack.id,
      isPrimary: true,
      origin: DamageOrigin.ActionDirect,
    };
    expect(
      s.hooks.emit(HookName.OnHealCalc, { ...base, heal: 1000 }).heal,
    ).toBeCloseTo(1220.8);
    expect(
      s.hooks.emit(HookName.OnBarrierCalc, { ...base, barrier: 1000 }).barrier,
    ).toBeCloseTo(1150);
    expect(
      s.hooks.emit(HookName.OnHealCalc, {
        ...base,
        heal: 1000,
        isPrimary: false,
      }).heal,
    ).toBe(1000);
    expect(
      s.hooks.emit(HookName.OnHealCalc, {
        ...base,
        heal: 1000,
        origin: DamageOrigin.HookDerived,
      }).heal,
    ).toBe(1000);
  });
  it('回合恢复受半血/半蓝、伤势和存活限制，且向下取整', () => {
    const s = setup(['changchun', 'qingquan', 'qingmu', 'yudan']);
    s.unit('a').attrs.hp = 4990;
    s.unit('a').attrs.mp = 490;
    s.hooks.emit(HookName.OnRoundEnd);
    expect(s.unit('a').attrs.hp).toBe(5065);
    expect(s.unit('a').attrs.mp).toBe(497);
    s.unit('a').wound = 5100;
    s.unit('a').attrs.hp = 4800;
    s.hooks.emit(HookName.OnRoundEnd);
    s.hooks.emit(HookName.OnRoundEnd);
    expect(s.unit('a').attrs.hp).toBe(4900);
    s.unit('a').flags.downed = true;
    s.unit('a').attrs.hp = 0;
    s.hooks.emit(HookName.OnRoundEnd);
    expect(s.unit('a').attrs.hp).toBe(0);
  });
  it.each([false, true])('实际行动保留比例固伤分类：%s', (percentageDamage) => {
    const s = setup(['yousha'], 9, {
      ...attack,
      effects: [{ type: EffectType.FixedHit, power: 1000, percentageDamage }],
    });
    s.unit('b').attrs.hp = 3000;
    s.submit('a', {
      type: CommandType.Skill,
      skillId: attack.id,
      targets: ['b'],
    });
    s.submit('b', { type: CommandType.Defend });
    s.lockAndResolve();
    expect(s.unit('b').attrs.hp).toBe(percentageDamage ? 2000 : 1940);
  });
  it('五雷的所有百分比伤害分支有显式分类，保持原有其他效果', () => {
    const skill = JIUJIE_COMBAT.skills.find((s) =>
      s.definition.effects.some((e) => e.type === EffectType.RandomBranch),
    )!.definition;
    for (const effect of skill.effects)
      if (effect.type === EffectType.RandomBranch) {
        for (const branch of [
          ...effect.successEffects,
          ...effect.failureEffects,
        ])
          if (branch.type === EffectType.FixedHit)
            expect(branch.percentageDamage).toBe(true);
      }
  });
});
