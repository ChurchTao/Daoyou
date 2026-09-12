import { describe, expect, it } from 'vitest';
import { combatV6SkillDetails } from '../../../combat-v6/skill-details';
import { CommandType, EventType, createBattle, type LineupUnit } from '../core';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_7C_VERSIONS } from '../version';
import { BEAST_SKILLS, BEAST_SKILL_FAMILIES, BEAST_SPECIES } from './content';
import { generateStarterBeast } from './generator';
import {
  activeBeastSkills,
  beastPanel,
  projectBeastRoster,
} from './projection';

const id = '00000000-0000-4000-8000-000000000001';
function beast(skills: string[]) {
  return {
    ...generateStarterBeast(id, id, BEAST_SPECIES[0].id, 42),
    skills,
    skillSlotCapacity: skills.length,
  };
}
const ruleset = createDaoyouRuleset({
  formulas: {
    physicalHitChance: () => 1,
    spellHitChance: () => 1,
    fluctuationMin: 1,
    fluctuationMax: 1,
    physicalFluctuationMin: 1,
    physicalFluctuationMax: 1,
  },
});
function battle(
  passives: string[] = [],
  seed = 1,
  overrides: Partial<LineupUnit> = {},
  enemyPassives: string[] = [],
) {
  return createBattle({
    seed,
    versions: COMBAT_V6_PHASE_7C_VERSIONS,
    ruleset,
    skills: BEAST_SKILLS,
    units: [
      {
        id: 'pet',
        name: 'pet',
        kind: 'player',
        side: 0,
        level: 10,
        skills: [
          'beast.spirit-flame',
          'beast.thunder',
          'beast.falling-rock',
          'beast.water-attack',
        ],
        passives: activeBeastSkills(beast(passives)),
        attrs: {
          hp: 500,
          maxHp: 1000,
          mp: 50,
          maxMp: 100,
          speed: 100,
          physicalAtk: 100,
          magicAtk: 100,
        },
        ...overrides,
      },
      {
        id: 'enemy',
        name: 'enemy',
        kind: 'npc',
        side: 1,
        skills: ['beast.spirit-flame'],
        passives: enemyPassives,
        attrs: {
          hp: 10000,
          mp: 100,
          maxMp: 100,
          speed: 1,
          physicalAtk: 100,
          magicAtk: 100,
        },
      },
    ],
  });
}
function attack(passives: string[], spell = false, seed = 1) {
  const b = battle(passives, seed);
  b.submit(
    'pet',
    spell
      ? {
          type: CommandType.Skill,
          skillId: 'beast.spirit-flame',
          targets: ['enemy'],
        }
      : { type: CommandType.Attack, target: 'enemy' },
  );
  b.submit('enemy', { type: CommandType.Defend });
  b.lockAndResolve();
  return b.log();
}

describe('经典兽诀首批', () => {
  it.each(BEAST_SKILL_FAMILIES)(
    '$advanced suppresses its normal family in projection',
    ({ normal, advanced }) => {
      const b = beast([normal, advanced]);
      expect(activeBeastSkills(b)).toEqual([advanced]);
      const projected = projectBeastRoster(
        {
          beasts: [b],
          lineup: { carriedBeastIds: [id], leadBeastId: id, revision: 0 },
        },
        id,
        0,
        0,
      )[0];
      expect(projected.passives).toEqual([advanced]);
    },
  );

  it('迅捷、迟钝只调整速度，高级迅捷不与普通叠加', () => {
    const base = beastPanel(beast([]));
    for (const [skills, factor] of [
      [['beast.agility'], 1.1],
      [['beast.advanced-agility'], 1.2],
      [['beast.agility', 'beast.advanced-agility'], 1.2],
      [['beast.sluggish'], 0.8],
      [['beast.advanced-agility', 'beast.sluggish'], 1.2 * 0.8],
    ] as const)
      expect(beastPanel(beast([...skills]))).toEqual({
        ...base,
        speed: Math.floor(base.speed * factor),
      });
  });

  it.each([
    ['beast.regeneration', 5, 0],
    ['beast.advanced-regeneration', 10, 0],
    ['beast.meditation', 0, 2],
    ['beast.advanced-meditation', 0, 3],
  ] as const)('%s 在回合末按等级恢复且不超上限', (skill, hp, mp) => {
    const b = battle([skill]);
    b.submit('pet', { type: CommandType.Defend });
    b.submit('enemy', { type: CommandType.Defend });
    b.lockAndResolve();
    expect(b.snapshot().units[0].attrs).toMatchObject({
      hp: 500 + hp,
      mp: 50 + mp,
    });
    const full = battle([skill], 1, {
      attrs: { hp: 999, maxHp: 1000, mp: 99, maxMp: 100 },
    });
    full.submit('pet', { type: CommandType.Defend });
    full.submit('enemy', { type: CommandType.Defend });
    full.lockAndResolve();
    expect(full.snapshot().units[0].attrs).toMatchObject({
      hp: Math.min(1000, 999 + hp),
      mp: Math.min(100, 99 + mp),
    });
  });

  it('自愈不能救回死亡灵兽，后备灵兽不获得回合恢复', () => {
    const dead = battle(['beast.advanced-regeneration'], 1, {
      kind: 'pet',
      ownerId: 'enemy',
      attrs: { hp: 1, maxHp: 1000, speed: 100 },
    });
    dead.submit('pet', { type: CommandType.Defend });
    dead.submit('enemy', { type: CommandType.Attack, target: 'pet' });
    dead.lockAndResolve();
    expect(dead.snapshot().units[0].attrs.hp).toBe(0);
    const reserve = battle(['beast.regeneration', 'beast.meditation'], 1, {
      kind: 'pet',
      benched: true,
    });
    reserve.submit('enemy', { type: CommandType.Defend });
    reserve.lockAndResolve();
    expect(reserve.snapshot().units[0].attrs).toMatchObject({
      hp: 500,
      mp: 50,
    });
  });

  it.each([
    ['beast.spell-mastery', 1.1],
    ['beast.advanced-spell-mastery', 1.2],
  ] as const)('%s 只增幅法术伤害', (skill, factor) => {
    const damage = (skills: string[], spell: boolean) =>
      attack(skills, spell)
        .filter((e) => e.type === EventType.Damage && e.sourceId === 'pet')
        .map((e) => e.amount)[0];
    expect(damage([skill], true)).toBe(Math.floor(damage([], true) * factor));
    expect(damage([skill], false)).toBe(damage([], false));
  });

  it.each([
    ['beast.critical', false],
    ['beast.advanced-critical', false],
    ['beast.spell-critical', true],
    ['beast.advanced-spell-critical', true],
  ] as const)('%s 能触发对应暴击且不影响另一伤害类型', (skill, spell) => {
    let crits = 0;
    for (let seed = 1; seed <= 64; seed++) {
      crits += attack([skill], spell, seed).filter(
        (e) => e.type === EventType.Hit && e.sourceId === 'pet' && e.crit,
      ).length;
      expect(attack([skill], !spell, seed)).toEqual(attack([], !spell, seed));
    }
    expect(crits).toBeGreaterThan(0);
    expect(crits).toBeLessThan(64);
  });

  it.each(['beast.counter', 'beast.advanced-counter'])(
    '%s 可以反扑且不会互相无限反扑，也不反扑法术',
    (skill) => {
      let counters = 0;
      for (let seed = 1; seed <= 32; seed++) {
        for (const spell of [false, true]) {
          const b = battle([skill], seed, {}, [skill]);
          b.submit('pet', { type: CommandType.Defend });
          b.submit(
            'enemy',
            spell
              ? {
                  type: CommandType.Skill,
                  skillId: 'beast.spirit-flame',
                  targets: ['pet'],
                }
              : { type: CommandType.Attack, target: 'pet' },
          );
          b.lockAndResolve();
          const hits = b.log().filter((e) => e.type === EventType.Hit);
          expect(hits.length).toBeLessThanOrEqual(spell ? 1 : 2);
          counters += hits.filter((e) => e.sourceId === 'pet').length;
        }
      }
      expect(counters).toBeGreaterThan(0);
    },
  );

  it.each(['beast.thunder', 'beast.falling-rock', 'beast.water-attack'])(
    '%s 可施放、只命中一个目标并扣除法力',
    (skillId) => {
      const b = battle();
      b.submit('pet', { type: CommandType.Skill, skillId, targets: ['enemy'] });
      b.submit('enemy', { type: CommandType.Defend });
      b.lockAndResolve();
      expect(b.snapshot().units[0].attrs.mp).toBe(40);
      expect(
        b
          .log()
          .filter((e) => e.type === EventType.Damage && e.sourceId === 'pet'),
      ).toHaveLength(1);
      expect(b.log().some((e) => e.type === EventType.ActionFailed)).toBe(
        false,
      );
    },
  );

  it('每本新兽诀都具备玩家可理解的效果说明', () => {
    const details = combatV6SkillDetails(BEAST_SKILLS, []);
    for (const skill of BEAST_SKILLS.slice(5)) {
      expect(details[skill.id].description).not.toContain('依技能条件触发');
      expect(details[skill.id].description).not.toContain('source.');
    }
  });
});

it('第四阶段的加攻加防使用共用面板，普通高级不重复加成', () => {
  const base = beastPanel(beast([]));
  for (const [skills, attack, defense] of [
    [['beast.strength'], 4, 0],
    [['beast.advanced-strength'], 5, 0],
    [['beast.defense'], 0, 6],
    [['beast.advanced-defense'], 0, 8],
    [
      [
        'beast.strength',
        'beast.advanced-strength',
        'beast.defense',
        'beast.advanced-defense',
      ],
      5,
      8,
    ],
  ] as const) {
    expect(beastPanel(beast([...skills]))).toEqual({
      ...base,
      physicalAtk: base.physicalAtk + attack,
      physicalDef: base.physicalDef + defense,
    });
  }
});

it('高级灵觉的躲避加成进入共用面板，高低级同时持有不叠加', () => {
  const base = beastPanel(beast([]));
  expect(beastPanel(beast(['beast.perception']))).toEqual(base);
  expect(beastPanel(beast(['beast.perception', 'beast.advanced-perception']))).toEqual({ ...base, dodge: base.dodge + 10 });
});
