import { describe, expect, it } from 'vitest';
import { combatV6SkillDetails } from '../../../combat-v6/skill-details';
import {
  CommandType,
  DamageKind,
  EffectType,
  EventType,
  SkillTag,
  TargetSide,
  createBattle,
  type SkillDef,
} from '../core';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_7C_VERSIONS } from '../version';
import { BEAST_SKILLS, BEAST_SKILL_CONTENT } from './content';
import { beastDeathIds } from './progression';
import { compileBeastSkill } from './skill-compiler';

const ruleset = createDaoyouRuleset({
  formulas: {
    physicalHitChance: () => 1,
    spellHitChance: () => 1,
    physicalFluctuationMin: 1,
    physicalFluctuationMax: 1,
    fluctuationMin: 1,
    fluctuationMax: 1,
    defendPhysicalFactor: 1,
    baseDamage: ({ kind, power, source }) =>
      kind === DamageKind.Fixed
        ? Math.max(1, power)
        : kind === DamageKind.Physical
          ? source.attrs.physicalAtk
          : source.attrs.magicAtk,
  },
});
const hit: SkillDef = {
  id: 'test.physical',
  name: '物攻',
  tags: [SkillTag.Physical],
  targeting: { side: TargetSide.Enemy, count: 1 },
  effects: [{ type: EffectType.PhysicalHit }],
};
const magic: SkillDef = {
  ...hit,
  id: 'test.spell',
  tags: [SkillTag.Spell],
  effects: [{ type: EffectType.SpellHit }],
};
function create(
  own: string[] = [],
  enemy: string[] = [],
  forced = false,
  seed = 1,
) {
  const skills = BEAST_SKILLS.map((skill) => {
    const entry = BEAST_SKILL_CONTENT.find((e) => e.id === skill.id)!;
    return forced && 'chance' in entry.effect
      ? compileBeastSkill({ ...entry, effect: { ...entry.effect, chance: 1 } })
      : skill;
  });
  return createBattle({
    seed,
    versions: COMBAT_V6_PHASE_7C_VERSIONS,
    ruleset,
    skills: [...skills, hit, magic],
    statusDefs: [
      {
        id: 'test.no-revive',
        name: '禁复活',
        kind: 'test.no-revive',
        blocksRevive: true,
      },
    ],
    units: [
      {
        id: 'beast:pet',
        name: '灵兽',
        kind: 'pet',
        ownerId: 'owner',
        side: 0,
        passives: own,
        skills: [hit.id, magic.id],
        attrs: {
          hp: 500,
          maxHp: 1000,
          speed: 100,
          physicalAtk: 100,
          magicAtk: 100,
        },
      },
      {
        id: 'enemy',
        name: '敌方',
        kind: 'npc',
        side: 1,
        passives: enemy,
        skills: [hit.id, magic.id],
        attrs: {
          hp: 1000,
          maxHp: 1000,
          speed: 10,
          physicalAtk: 100,
          magicAtk: 100,
        },
      },
      {
        id: 'owner',
        name: '主人',
        kind: 'player',
        side: 0,
        attrs: { hp: 1000, speed: 1 },
      },
    ],
  });
}
function resolve(
  b: ReturnType<typeof create>,
  actor = 'beast:pet',
  spell = false,
) {
  const target = actor === 'enemy' ? 'beast:pet' : 'enemy';
  b.submit(actor, {
    type: CommandType.Skill,
    skillId: spell ? magic.id : hit.id,
    targets: [target],
  });
  b.submit(target, { type: CommandType.Defend });
  b.submit('owner', { type: CommandType.Defend });
  b.lockAndResolve();
}
function barrier(b: ReturnType<typeof create>, id: string, power: number) {
  b.unit(id).barriers.push({
    id: 'test.shield',
    kind: 'test',
    name: '护盾',
    current: power,
    remainingRounds: 10,
    appliedRound: 1,
    sourceId: id,
  });
}

describe('第二批经典兽诀的真实内核交互', () => {
  it.each([
    ['beast.lifesteal', 25],
    ['beast.advanced-lifesteal', 30],
  ] as const)('%s 按实际扣血吸血，忽略治疗属性', (id, healed) => {
    const b = create([id]);
    b.unit('beast:pet').attrs.healPower = 10000;
    resolve(b);
    expect(b.unit('beast:pet').attrs.hp).toBe(500 + healed);
    expect(b.unit('enemy').attrs.hp).toBe(900);
  });
  it('吸血扣除护盾、排除过量伤害，且不能超出可恢复上限', () => {
    const shield = create(['beast.lifesteal']);
    barrier(shield, 'enemy', 60);
    resolve(shield);
    expect(shield.unit('beast:pet').attrs.hp).toBe(510);
    const lethal = create(['beast.lifesteal']);
    lethal.unit('enemy').attrs.hp = 20;
    resolve(lethal);
    expect(lethal.unit('beast:pet').attrs.hp).toBe(505);
    const capped = create(['beast.lifesteal']);
    capped.unit('beast:pet').attrs.hp = 899;
    capped.unit('beast:pet').wound = 100;
    resolve(capped);
    expect(capped.unit('beast:pet').attrs.hp).toBe(900);
  });
  it('法术、护盾全吸收及连击追加伤害不产生额外吸血', () => {
    const spell = create(['beast.lifesteal']);
    resolve(spell, 'beast:pet', true);
    expect(spell.unit('beast:pet').attrs.hp).toBe(500);
    const shield = create(['beast.lifesteal']);
    barrier(shield, 'enemy', 200);
    resolve(shield);
    expect(shield.unit('beast:pet').attrs.hp).toBe(500);
    for (const skills of [
      ['beast.lifesteal', 'beast.combo'],
      ['beast.combo', 'beast.lifesteal'],
    ]) {
      const combo = create(skills, [], true);
      resolve(combo);
      expect(combo.unit('beast:pet').attrs.hp).toBe(525);
      expect(
        combo
          .log()
          .filter(
            (e) => e.type === EventType.Damage && e.sourceId === 'beast:pet',
          ),
      ).toHaveLength(2);
    }
  });
  it.each([
    ['beast.reflection', false, 25],
    ['beast.advanced-reflection', false, 50],
    ['beast.spell-reflection', true, 25],
    ['beast.advanced-spell-reflection', true, 50],
  ] as const)('%s 只反震对应伤害并按固定伤害结算', (id, spell, damage) => {
    const b = create([], [id], true);
    b.unit('beast:pet').attrs.physicalDef = 10000;
    resolve(b, 'beast:pet', spell);
    expect(b.unit('beast:pet').attrs.hp).toBe(500 - damage);
    expect(
      b
        .log()
        .filter((e) => e.type === EventType.Damage && e.sourceId === 'enemy'),
    ).toMatchObject([{ amount: damage, kind: DamageKind.Fixed }]);
    const other = create([], [id], true);
    resolve(other, 'beast:pet', !spell);
    expect(other.unit('beast:pet').attrs.hp).toBe(500);
  });
  it('反震不递归、不阻止连击、不对护盾部分和过量伤害反震', () => {
    const both = create(
      ['beast.reflection', 'beast.combo'],
      ['beast.reflection'],
      true,
    );
    resolve(both);
    expect(both.log().filter((e) => e.type === EventType.Damage)).toHaveLength(
      3,
    );
    const shield = create([], ['beast.reflection'], true);
    barrier(shield, 'enemy', 60);
    resolve(shield);
    expect(shield.unit('beast:pet').attrs.hp).toBe(490);
    const full = create([], ['beast.reflection'], true);
    barrier(full, 'enemy', 100);
    resolve(full);
    expect(full.unit('beast:pet').attrs.hp).toBe(500);
    const lethal = create([], ['beast.reflection'], true);
    lethal.unit('enemy').attrs.hp = 20;
    resolve(lethal);
    expect(lethal.unit('beast:pet').attrs.hp).toBe(495);
  });
  it.each([
    ['beast.divine-revival', 600],
    ['beast.advanced-divine-revival', 1000],
  ] as const)('%s 致命伤害后恢复气血且不计死亡，可再次触发', (id, hp) => {
    const b = create([id], [], true);
    b.unit('beast:pet').attrs.hp = 1;
    resolve(b, 'enemy');
    expect(b.unit('beast:pet').attrs.hp).toBe(hp);
    expect(b.unit('beast:pet').flags.dead).toBe(false);
    expect(beastDeathIds(b.log())).toEqual([]);
    b.unit('enemy').attrs.physicalAtk = 2000;
    resolve(b, 'enemy');
    expect(b.unit('beast:pet').attrs.hp).toBe(hp);
    expect(
      b.log().filter((e) => e.type === EventType.UnitRevived),
    ).toHaveLength(2);
  });
  it('神佑受禁复活与伤势限制，非致命伤害不触发', () => {
    const blocked = create(['beast.divine-revival'], [], true);
    blocked.unit('beast:pet').attrs.hp = 1;
    blocked.applyStatus('beast:pet', 'test.no-revive', 5);
    resolve(blocked, 'enemy');
    expect(beastDeathIds(blocked.log())).toEqual(['pet']);
    expect(blocked.unit('beast:pet').attrs.hp).toBe(0);
    const wounded = create(['beast.advanced-divine-revival'], [], true);
    wounded.unit('beast:pet').attrs.hp = 1;
    wounded.unit('beast:pet').wound = 200;
    resolve(wounded, 'enemy');
    expect(wounded.unit('beast:pet').attrs.hp).toBe(800);
    const safe = create(['beast.divine-revival'], [], true);
    resolve(safe, 'enemy');
    expect(safe.log().some((e) => e.type === EventType.UnitRevived)).toBe(
      false,
    );
  });
  it('反震可触发攻击者神佑；反震致死后吸血不能复活攻击者', () => {
    const revived = create(
      ['beast.divine-revival'],
      ['beast.reflection'],
      true,
    );
    revived.unit('beast:pet').attrs.hp = 10;
    resolve(revived);
    expect(revived.unit('beast:pet').attrs.hp).toBe(600);
    const dead = create(['beast.lifesteal'], ['beast.reflection'], true);
    dead.unit('beast:pet').attrs.hp = 10;
    resolve(dead);
    expect(dead.unit('beast:pet').attrs.hp).toBe(0);
    expect(beastDeathIds(dead.log())).toEqual(['pet']);
  });
  it('神佑成功不会改变本次吸血基数', () => {
    const b = create(['beast.lifesteal'], ['beast.divine-revival'], true);
    b.unit('enemy').attrs.hp = 20;
    resolve(b);
    expect(b.unit('enemy').attrs.hp).toBe(600);
    expect(b.unit('beast:pet').attrs.hp).toBe(505);
  });
  it.each([
    'beast.reflection',
    'beast.spell-reflection',
    'beast.divine-revival',
    'beast.advanced-divine-revival',
  ])('%s 固定种子可重放，配置概率存在成功和失败', (id) => {
    const outcomes = new Set<boolean>();
    for (let seed = 1; seed <= 64; seed++) {
      const run = () => {
        const b = create([id], [], false, seed);
        b.unit('beast:pet').attrs.hp = 1;
        resolve(b, 'enemy', id.includes('spell-reflection'));
        return b.log();
      };
      const events = run();
      expect(events).toEqual(run());
      outcomes.add(
        events.some((e) =>
          id.includes('revival')
            ? e.type === EventType.UnitRevived
            : e.type === EventType.Damage && e.sourceId === 'beast:pet',
        ),
      );
    }
    expect(outcomes.size).toBe(2);
  });
  it('新技能说明明确迁移后的交互限制', () => {
    const details = combatV6SkillDetails(BEAST_SKILLS, []);
    expect(details['beast.lifesteal'].description).toContain(
      '追加攻击与反击不触发',
    );
    expect(details['beast.reflection'].description).toContain('不阻止连击');
    expect(details['beast.divine-revival'].description).toContain(
      '成功不计死亡',
    );
  });
});

describe('第三阶段：慧根、偷袭、法术抵抗', () => {
  it.each([
    ['beast.wisdom', 7],
    ['beast.advanced-wisdom', 5],
  ] as const)('%s 的法术预览费用等于实际扣费，物理不减耗', (id, cost) => {
    for (const spell of [false, true]) {
      const b = create([id]);
      const source = b.unit('beast:pet');
      source.attrs.mp = 100;
      source.attrs.maxMp = 100;
      source.skillOverrides[hit.id] = { ...hit, costMp: 10 };
      source.skillOverrides[magic.id] = { ...magic, costMp: 10 };
      const option = b
        .queryCommands(source.id)
        .skills.find((s) => s.skillId === (spell ? magic.id : hit.id))!;
      expect(option.costs.mp).toBe(spell ? cost : 10);
      resolve(b, source.id, spell);
      expect(source.attrs.mp).toBe(100 - (spell ? cost : 10));
    }
  });
  it.each([
    'beast.counter',
    'beast.advanced-counter',
    'beast.reflection',
    'beast.advanced-reflection',
  ])('偷袭阻止 %s 且不关闭神佑', (retaliation) => {
    for (const [id, damage] of [
      ['beast.sneak-attack', 105],
      ['beast.advanced-sneak-attack', 110],
    ] as const) {
      const b = create([id], [retaliation, 'beast.divine-revival'], true);
      resolve(b);
      expect(b.unit('enemy').attrs.hp).toBe(1000 - damage);
      expect(b.unit('beast:pet').attrs.hp).toBe(500);
      b.unit('enemy').attrs.hp = 1;
      resolve(b);
      expect(b.unit('enemy').attrs.hp).toBe(600);
      expect(
        b
          .log()
          .filter((e) => e.type === EventType.Damage && e.sourceId === 'enemy'),
      ).toHaveLength(0);
    }
  });
  it('偷袭不阻止法术反震，也不屏蔽保护者之外的受击逻辑', () => {
    const b = create(['beast.sneak-attack'], ['beast.spell-reflection'], true);
    resolve(b, 'beast:pet', true);
    expect(b.unit('beast:pet').attrs.hp).toBe(475);
    const protect = create(
      ['beast.reflection'],
      ['beast.advanced-sneak-attack'],
      true,
    );
    protect.submit('beast:pet', { type: CommandType.Protect, target: 'owner' });
    protect.submit('owner', { type: CommandType.Defend });
    protect.submit('enemy', {
      type: CommandType.Skill,
      skillId: hit.id,
      targets: ['owner'],
    });
    protect.lockAndResolve();
    expect(protect.unit('beast:pet').attrs.hp).toBe(390);
    expect(protect.unit('enemy').attrs.hp).toBe(1000);
  });
  it.each([
    ['beast.spell-resistance', 95],
    ['beast.advanced-spell-resistance', 90],
  ] as const)('%s 减免法术并降低自身物理输出，不减免固定反震', (id, damage) => {
    const defense = create([id]);
    resolve(defense, 'enemy', true);
    expect(defense.unit('beast:pet').attrs.hp).toBe(500 - damage);
    const attack = create([id], ['beast.reflection'], true);
    resolve(attack);
    expect(attack.unit('enemy').attrs.hp).toBe(910);
    expect(attack.unit('beast:pet').attrs.hp).toBe(478);
  });
});

describe('第四阶段：物理防护与强力', () => {
  it.each([
    ['beast.parry', 90],
    ['beast.advanced-parry', 80],
  ] as const)('%s 只减免回合首次命中，下一回合重置', (id, amount) => {
    const b = create([id]);
    b.unit('enemy').skillOverrides[hit.id] = {
      ...hit,
      effects: [{ type: EffectType.PhysicalHit, hits: 2 }],
    };
    resolve(b, 'enemy');
    expect(b.unit('beast:pet').attrs.hp).toBe(500 - amount - 100);
    resolve(b, 'enemy');
    expect(b.unit('beast:pet').attrs.hp).toBe(500 - 2 * amount - 200);
  });
  it('护盾全吸收仍消耗招架；法术不消耗招架', () => {
    const b = create(['beast.parry']);
    barrier(b, 'beast:pet', 90);
    b.unit('enemy').skillOverrides[hit.id] = {
      ...hit,
      effects: [{ type: EffectType.PhysicalHit, hits: 2 }],
    };
    resolve(b, 'enemy');
    expect(b.unit('beast:pet').attrs.hp).toBe(400);
    const mixed = create(['beast.parry']);
    mixed.unit('enemy').skillOverrides[magic.id] = {
      ...magic,
      effects: [
        { type: EffectType.SpellHit },
        { type: EffectType.PhysicalHit },
      ],
    };
    resolve(mixed, 'enemy', true);
    expect(mixed.unit('beast:pet').attrs.hp).toBe(310);
  });
  it.each(['beast.strength', 'beast.advanced-strength'])(
    '%s 忽略招架，但只对防御技能目标承担代价',
    (id) => {
      const parry = create([id], ['beast.advanced-parry']);
      resolve(parry);
      expect(parry.unit('enemy').attrs.hp).toBe(900);
      for (const defense of ['beast.defense', 'beast.advanced-defense']) {
        const b = create([id], [defense, 'beast.parry']);
        resolve(b);
        expect(b.unit('enemy').attrs.hp).toBe(920);
      }
      const plain = create([id]);
      resolve(plain);
      expect(plain.unit('enemy').attrs.hp).toBe(900);
    },
  );
  it.each([
    ['beast.defense', 90],
    ['beast.advanced-defense', 95],
  ] as const)('%s 承担对应法伤代价', (id, amount) => {
    const b = create([id]);
    resolve(b, 'beast:pet', true);
    expect(b.unit('enemy').attrs.hp).toBe(1000 - amount);
  });
});

it('第五阶段组合矩阵：普攻与主动攻击、派生链、同种子事件、死亡次数均有界', () => {
  for (let mask = 0; mask < 64; mask++) {
    const own = ['beast.combo', 'beast.lifesteal', 'beast.sneak-attack'].filter(
      (_, i) => mask & (1 << i),
    );
    const enemy = [
      'beast.reflection',
      'beast.counter',
      'beast.divine-revival',
    ].filter((_, i) => mask & (1 << (i + 3)));
    for (const basic of [false, true]) {
      const run = () => {
        const b = create(own, enemy, false, mask + 1);
        b.unit('enemy').attrs.hp = 40;
        b.unit('beast:pet').attrs.hp = 15;
        b.submit(
          'beast:pet',
          basic
            ? { type: CommandType.Attack, target: 'enemy' }
            : { type: CommandType.Skill, skillId: hit.id, targets: ['enemy'] },
        );
        b.submit('enemy', { type: CommandType.Defend });
        b.submit('owner', { type: CommandType.Defend });
        b.lockAndResolve();
        return { state: b.snapshot(), events: b.log() };
      };
      const result = run();
      expect(result).toEqual(run());
      expect(
        result.events.filter((e) => e.type === EventType.Damage).length,
      ).toBeLessThanOrEqual(4);
      expect(
        result.events.filter(
          (e) => e.type === EventType.UnitDead && e.unitId === 'beast:pet',
        ).length,
      ).toBeLessThanOrEqual(1);
      for (const unit of result.state.units) {
        expect(unit.attrs.hp).toBeGreaterThanOrEqual(0);
        expect(unit.attrs.hp).toBeLessThanOrEqual(unit.attrs.maxHp);
        if (unit.flags.dead) expect(unit.attrs.hp).toBe(0);
      }
    }
  }
});
