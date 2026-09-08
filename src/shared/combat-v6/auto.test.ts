import { describe, expect, it } from 'vitest';
import { COMBAT_V6_SECT_DEFINITIONS_V4 } from '../engine/combat-v6/content';
import { createBattle, type SkillDef } from '../engine/combat-v6/core';
import type { CombatV6TrainingPlayerInput } from '../engine/combat-v6/encounter';
import { compileRankingBattle } from '../engine/combat-v6/ranking/battle';
import { daoyouRulesetV6 } from '../engine/combat-v6/rules-daoyou';
import { COMBAT_V6_PHASE_6D_VERSIONS } from '../engine/combat-v6/version';
import { automaticCommands, CombatAutoRequestSchema } from './auto';

const skills: SkillDef[] = [
  {
    id: 'heal',
    name: '治疗',
    tags: ['support'],
    costMp: 10,
    targeting: { side: 'ally' },
    effects: [{ type: 'heal', power: 100 }],
  },
  {
    id: 'revive',
    name: '复活',
    tags: ['support'],
    costMp: 10,
    targeting: { side: 'ally', includeDowned: true },
    effects: [{ type: 'revive', hpRatio: 0.3 }],
  },
  {
    id: 'strike',
    name: '攻击术',
    tags: ['spell'],
    costMp: 10,
    targeting: { side: 'enemy' },
    effects: [{ type: 'spellHit', power: 100 }],
  },
  {
    id: 'capture',
    name: '捕捉',
    tags: ['support'],
    targeting: { side: 'enemy' },
    effects: [],
    capture: { targetMpCosts: { enemy: 1 }, capacity: 6, chance: 1 },
  },
  {
    id: 'ward',
    name: '护体',
    tags: ['support'],
    targeting: { side: 'self' },
    effects: [{ type: 'applyStatus', statusId: 'guard', duration: 3 }],
  },
];
function fixture(skillIds = ['heal', 'revive', 'strike', 'capture']) {
  const attrs = {
    hp: 1000,
    maxHp: 1000,
    mp: 100,
    maxMp: 100,
    speed: 50,
    physicalAtk: 50,
    physicalDef: 50,
  };
  return createBattle({
    seed: 42,
    versions: COMBAT_V6_PHASE_6D_VERSIONS,
    ruleset: daoyouRulesetV6,
    skills,
    statusDefs: [
      { id: 'guard', name: '护体', kind: 'guard' },
      { id: 'stealth', name: '隐身', kind: 'stealth', untargetable: true },
      { id: 'reveal', name: '感知', kind: 'reveal', revealStealth: true },
    ],
    units: [
      {
        id: 'player',
        name: '人物',
        kind: 'player',
        side: 0,
        level: 60,
        skills: skillIds,
        attrs,
      },
      {
        id: 'ally',
        name: '队友',
        kind: 'player',
        side: 0,
        level: 60,
        slot: 1,
        attrs,
      },
      {
        id: 'pet',
        name: '灵兽',
        kind: 'pet',
        ownerId: 'player',
        side: 0,
        level: 60,
        slot: 4,
        attrs,
      },
      {
        id: 'reserve',
        name: '后备灵兽',
        kind: 'pet',
        ownerId: 'player',
        side: 0,
        level: 60,
        slot: 5,
        benched: true,
        attrs,
      },
      { id: 'enemy', name: '敌人', kind: 'npc', side: 1, level: 60, attrs },
    ],
  });
}
function choose(battle: ReturnType<typeof fixture>) {
  return automaticCommands(battle.snapshot(), 'player', skills, (id) =>
    battle.queryCommands(id),
  );
}
describe('当前场次托管', () => {
  it('AUTO 是带回合和版本号的一次性请求，不接受旧开关协议', () => {
    expect(
      CombatAutoRequestSchema.safeParse({
        type: 'AUTO',
        round: 1,
        expectedRevision: 0,
      }).success,
    ).toBe(true);
    for (const input of [
      { enabled: true, expectedRevision: 0 },
      { type: 'AUTO', round: 0, expectedRevision: 0 },
      { type: 'AUTO', round: 1, expectedRevision: -1 },
    ])
      expect(CombatAutoRequestSchema.safeParse(input).success).toBe(false);
  });
  it('只控制本人和在场灵兽，确定性且不修改 RNG、快照或战报', () => {
    const battle = fixture();
    const before = battle.snapshot();
    const log = structuredClone(battle.log());
    const result = choose(battle);
    expect(result.map((e) => e.unitId)).toEqual(['player', 'pet']);
    expect(result[0].command).toEqual({
      type: 'skill',
      skillId: 'strike',
      targets: ['enemy'],
    });
    expect(choose(battle)).toEqual(result);
    expect(battle.snapshot()).toEqual(before);
    expect(battle.log()).toEqual(log);
  });
  it('低血治疗、倒地复活优先，不对满血目标治疗', () => {
    const battle = fixture();
    battle.unit('ally').attrs.hp = 200;
    expect(choose(battle)[0].command).toEqual({
      type: 'skill',
      skillId: 'heal',
      targets: ['ally'],
    });
    battle.unit('ally').attrs.hp = 0;
    battle.unit('ally').flags.downed = true;
    expect(choose(battle)[0].command).toEqual({
      type: 'skill',
      skillId: 'revive',
      targets: ['ally'],
    });
  });
  it('无蓝降级普攻，只有捕捉也不会自动捕捉，保留已提交手动指令', () => {
    const battle = fixture();
    battle.unit('player').attrs.mp = 0;
    expect(choose(battle)[0].command).toEqual({
      type: 'attack',
      target: 'enemy',
    });
    expect(choose(fixture(['capture']))[0].command).toEqual({
      type: 'attack',
      target: 'enemy',
    });
    battle.submit('player', { type: 'defend' });
    expect(choose(battle)[0].command).toEqual({ type: 'defend' });
  });
  it('不重复施加已有状态，无合法敌人时防御', () => {
    const battle = fixture(['ward']);
    expect(choose(battle)[0].command.type).toBe('skill');
    battle.applyStatus('player', 'guard', 3);
    expect(choose(battle)[0].command.type).toBe('attack');
    battle.unit('enemy').flags.escaped = true;
    expect(choose(battle)[0].command).toEqual({ type: 'defend' });
  });
  it('无蓝时不普攻隐身目标，有感知后可以攻击', () => {
    const battle = fixture([]);
    battle.applyStatus('enemy', 'stealth', 3);
    expect(choose(battle)[0].command).toEqual({ type: 'defend' });
    battle.applyStatus('player', 'reveal', 3);
    expect(choose(battle)[0].command).toEqual({
      type: 'attack',
      target: 'enemy',
    });
  });
});

for (const definition of Object.values(COMBAT_V6_SECT_DEFINITIONS_V4)) {
  for (const path of definition.paths) {
    it(`${definition.id}/${path.id} 冻结构筑可连续托管且指令可复现`, () => {
      const player = (id: string): CombatV6TrainingPlayerInput => ({
        cultivator: {
          id,
          name: id,
          realm: '渡劫',
          realm_stage: '圆满',
          attributes: {
            vitality: 50,
            strength: 50,
            spirit: 50,
            endurance: 50,
            speed: 50,
            willpower: 50,
          },
        },
        sect: {
          version: 1,
          sectId: definition.id,
          methods: Object.fromEntries(
            definition.methods.map((m) => [m.id, 60]),
          ),
          activePathId: path.id,
          meridianDepth: 0,
          meridianLoadouts: definition.paths.map((p) => ({
            pathId: p.id,
            nodeIds: [],
            revision: 0,
          })) as CombatV6TrainingPlayerInput['sect']['meridianLoadouts'],
        },
        equipment: {},
        manuals: { version: 1, revision: 0, build: { slots: [] } },
      });
      const input = compileRankingBattle([player('a'), player('b')], 47);
      const battle = createBattle({ ...input, ruleset: daoyouRulesetV6 });
      for (let round = 0; round < 8 && !battle.finished; round++) {
        for (const id of ['a', 'b']) {
          const choose = () =>
            automaticCommands(
              battle.snapshot(),
              id,
              input.skills ?? [],
              (unitId) => battle.queryCommands(unitId),
            );
          const commands = choose();
          expect(choose()).toEqual(commands);
          for (const { unitId, command } of commands) {
            if (command.type === 'skill') {
              const option = battle
                .queryCommands(unitId)
                .skills.find((s) => s.skillId === command.skillId)!;
              expect(option.reasons).toEqual([]);
              expect(
                command.targets.every((target) =>
                  option.selectableTargetIds.includes(target),
                ),
              ).toBe(true);
            }
            battle.submit(unitId, command);
          }
        }
        battle.lockAndResolve();
      }
    });
  }
}
