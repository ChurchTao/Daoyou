import { CommandType, DamageKind, EventType } from '@daoyou/combat-core/enums';
import { createBattle } from '@daoyou/combat-core/session';
import { BEAST_SKILLS } from '@daoyou/game-content/beasts';
import { COMBAT_V6_SEAL_CURVE_TRAINING_VERSIONS } from '@daoyou/game-domain/combat';
import { expect, it } from 'vitest';
import { createDaoyouRuleset } from '../combat/daoyou/index.js';
import {
  BEAST_BAG_CAPACITY,
  captureMp,
  captureSkill,
  carriedBeastIds,
  nextBeastExp,
  receivedBeastPlacement,
  splitCapturedBeasts,
  warehouseBeastCount,
} from './progression.js';

it.each([
  [10, 110],
  [30, 130],
])('灵火等级%d消耗10法力并造成%d单体法伤', (level, damage) => {
  const skill = BEAST_SKILLS.find((s) => s.id === 'beast.spirit-flame')!;
  expect(skill).toBeDefined();
  const battle = createBattle({
    seed: 42,
    versions: COMBAT_V6_SEAL_CURVE_TRAINING_VERSIONS,
    ruleset: createDaoyouRuleset({
      formulas: {
        spellHitChance: () => 1,
        fluctuationMin: 1,
        fluctuationMax: 1,
      },
    }),
    skills: [skill],
    units: [
      {
        id: 'source',
        name: '施法者',
        side: 0,
        kind: 'pet',
        skills: [skill.id],
        skillLevels: { [skill.id]: level },
        attrs: {
          hp: 1000,
          mp: 100,
          maxMp: 100,
          magicAtk: 100,
          spellCritRate: 0,
          speed: 100,
        },
      },
      {
        id: 'target',
        name: '目标',
        side: 1,
        kind: 'npc',
        attrs: { hp: 1000, magicDef: 10, speed: 1 },
      },
      {
        id: 'other',
        name: '旁观目标',
        side: 1,
        kind: 'npc',
        attrs: { hp: 1000, magicDef: 10, speed: 1 },
      },
    ],
  });
  battle.submit('source', {
    type: CommandType.Skill,
    skillId: skill.id,
    targets: ['target'],
  });
  for (const id of ['target', 'other'])
    battle.submit(id, { type: CommandType.Defend });
  battle.lockAndResolve();
  expect(battle.unit('source').attrs.mp).toBe(90);
  expect(battle.unit('target').attrs.hp).toBe(1000 - damage);
  expect(battle.unit('other').attrs.hp).toBe(1000);
  expect(battle.log().filter((e) => e.type === EventType.Damage)).toMatchObject(
    [
      {
        sourceId: 'source',
        targetId: 'target',
        amount: damage,
        kind: DamageKind.Spell,
      },
    ],
  );
  expect(battle.log().some((e) => e.type === EventType.ActionFailed)).toBe(
    false,
  );
});

it('preserves capture identity, MP costs, formula and progression boundaries', () => {
  const skill = captureSkill(
    [{ unitId: 'fox', speciesId: 'combat.wild.species.spirit-fox' }],
    5,
    0,
  );
  expect(skill.capture?.targetMpCosts).toEqual({ fox: 15 });
  expect(skill.capture?.chance).toBe(
    'min(0.85, max(0.1, 0.35 + 0.4 * (1 - target.hp / target.maxHp) + 0.01 * (source.level - target.level)))',
  );
  expect(
    captureSkill(
      [{ unitId: 'fox', speciesId: 'combat.wild.species.spirit-fox' }],
      4,
      BEAST_BAG_CAPACITY,
    ).capture,
  ).toMatchObject({ capacity: 0, targetMpCosts: {} });
  expect(
    captureSkill(
      [{ unitId: 'fox', speciesId: 'combat.wild.species.spirit-fox' }],
      5,
      BEAST_BAG_CAPACITY - 1,
    ).capture?.capacity,
  ).toBe(1);
  expect(
    carriedBeastIds([{ id: 'carried' }, { id: 'stored' }], {
      carriedBeastIds: ['carried', 'missing'],
    }),
  ).toEqual(['carried']);
  expect(
    warehouseBeastCount([{ id: 'carried' }, { id: 'stored' }], {
      carriedBeastIds: ['carried'],
    }),
  ).toBe(1);
  expect(
    splitCapturedBeasts(BEAST_BAG_CAPACITY - 1, ['fit', 'overflow', 'rest']),
  ).toEqual({ bagIds: ['fit'], warehouseIds: ['overflow', 'rest'] });
  expect(splitCapturedBeasts(BEAST_BAG_CAPACITY, ['kept'])).toEqual({
    bagIds: [],
    warehouseIds: ['kept'],
  });
  expect(
    receivedBeastPlacement(
      [{ id: 'a' }, { id: 'b' }],
      { carriedBeastIds: [] },
      ['a', 'b'],
    ),
  ).toBe('bag');
  expect(
    receivedBeastPlacement(
      [
        ...Array.from({ length: BEAST_BAG_CAPACITY }, (_, index) => ({
          id: `bag-${index}`,
        })),
        { id: 'stored' },
      ],
      {
        carriedBeastIds: Array.from(
          { length: BEAST_BAG_CAPACITY },
          (_, index) => `bag-${index}`,
        ),
      },
      ['stored'],
    ),
  ).toBe('warehouse');
  expect(captureMp(5)).toBe(15);
  expect([0, 10, 179, 180].map(nextBeastExp)).toEqual([100, 350, 19700, 19900]);
});

it('tells the command query when the beast bag has no capture room', () => {
  const capture = captureSkill(
    [{ unitId: 'fox', speciesId: 'combat.wild.species.spirit-fox' }],
    30,
    BEAST_BAG_CAPACITY,
  );
  const battle = createBattle({
    seed: 1,
    versions: COMBAT_V6_SEAL_CURVE_TRAINING_VERSIONS,
    ruleset: createDaoyouRuleset(),
    skills: [capture],
    units: [
      {
        id: 'player',
        name: '修士',
        side: 0,
        kind: 'player',
        skills: [capture.id],
        attrs: { hp: 100, mp: 100, maxMp: 100, speed: 10 },
      },
      {
        id: 'fox',
        name: '狐',
        side: 1,
        kind: 'npc',
        attrs: { hp: 100, maxHp: 100, speed: 1 },
      },
    ],
  });
  const option = battle
    .queryCommands('player')
    .skills.find((skill) => skill.skillId === capture.id);
  expect(option?.ready).toBe(false);
  expect(option?.reasons).toContain('capture-capacity');
});
