import { expect, it } from 'vitest';
import {
  CommandType,
  EventType,
  SkillTag,
  createBattle,
  type SkillDef,
} from '../core';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_7C_VERSIONS } from '../version';
import { BEAST_SKILLS } from './content';
import before from './fixtures/before-g3.json';
import { captureMp, captureSkill, nextBeastExp } from './progression';

const ruleset = createDaoyouRuleset({
  formulas: {
    physicalHitChance: () => 1,
    spellHitChance: () => 1,
    fluctuationMin: 1,
    fluctuationMax: 1,
  },
});
function resolve(skill: SkillDef, seed: number) {
  const passive = skill.tags.includes(SkillTag.Passive);
  const battle = createBattle({
    seed,
    versions: COMBAT_V6_PHASE_7C_VERSIONS,
    ruleset,
    skills: [skill],
    units: [
      {
        id: 'source',
        name: '灵兽技能施放者',
        side: 0,
        kind: 'player',
        skills: passive ? [] : [skill.id],
        passives: passive ? [skill.id] : [],
        skillLevels: { [skill.id]: 10 },
        attrs: {
          hp: 1000,
          mp: 100,
          maxMp: 100,
          speed: 100,
          physicalAtk: 100,
          physicalDef: 10,
          magicAtk: 100,
          magicDef: 10,
        },
      },
      {
        id: 'target',
        name: 'target',
        side: 1,
        kind: 'npc',
        attrs: {
          hp: 1000,
          speed: 1,
          physicalAtk: 10,
          physicalDef: 10,
          magicDef: 10,
        },
      },
    ],
  });
  battle.submit(
    'source',
    passive
      ? { type: CommandType.Attack, target: 'target' }
      : { type: CommandType.Skill, skillId: skill.id, targets: ['target'] },
  );
  battle.submit('target', { type: CommandType.Defend });
  battle.lockAndResolve();
  return { state: battle.snapshot(), events: battle.log() };
}

it.each(BEAST_SKILLS)(
  'preserves $name events, costs and effects across fixed seeds',
  (skill) => {
    const old = before.skills.find(
      (s) => s.id === skill.id,
    ) as unknown as SkillDef;
    let maximumHits = 0;
    for (let seed = 1; seed <= 32; seed++) {
      const result = resolve(skill, seed);
      expect(result).toEqual(resolve(old, seed));
      expect(result.events.some((e) => e.type === EventType.ActionFailed)).toBe(
        false,
      );
      expect(result.state.units[0].attrs.mp).toBe(
        100 - Number(skill.costMp ?? 0),
      );
      maximumHits = Math.max(
        maximumHits,
        result.events.filter(
          (e) => e.type === EventType.Damage && e.sourceId === 'source',
        ).length,
      );
      if (skill.id === 'beast.stone-guard')
        expect(result.state.units[0].barriers.length).toBe(1);
      else expect(result.state.units[1].attrs.hp).toBeLessThan(1000);
    }
    if (skill.tags.includes(SkillTag.Passive)) expect(maximumHits).toBe(2);
  },
);

it('preserves capture identity, MP costs, formula and progression boundaries', () => {
  const skill = captureSkill(
    [{ unitId: 'fox', speciesId: before.species[0].id }],
    5,
    0,
  );
  expect(skill.capture?.targetMpCosts).toEqual({ fox: 15 });
  expect(skill.capture?.chance).toBe(
    'min(0.85, max(0.1, 0.35 + 0.4 * (1 - target.hp / target.maxHp) + 0.01 * (source.level - target.level)))',
  );
  expect(
    captureSkill([{ unitId: 'fox', speciesId: before.species[0].id }], 4, 24)
      .capture,
  ).toMatchObject({ capacity: 0, targetMpCosts: {} });
  expect(captureMp(5)).toBe(15);
  expect([0, 10, 179, 180].map(nextBeastExp)).toEqual([100, 300, 3680, 3700]);
});
