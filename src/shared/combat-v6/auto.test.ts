import { describe, expect, it } from 'vitest';
import { COMBAT_V6_SECT_DEFINITIONS_V4 } from '../engine/combat-v6/content';
import { createBattle, type SkillDef } from '../engine/combat-v6/core';
import type { CombatV6TrainingPlayerInput } from '../engine/combat-v6/encounter';
import { CombatV6PveHostSession } from '../engine/combat-v6/encounter/host';
import { compileRankingBattle } from '../engine/combat-v6/ranking/battle';
import { daoyouRulesetV6 } from '../engine/combat-v6/rules-daoyou';
import { COMBAT_V6_PHASE_6D_VERSIONS } from '../engine/combat-v6/version';
import { automaticCommands, CombatAutoRequestSchema } from './auto';
import { observeAutoBattle } from './auto-observation';
import { AUTO_POLICY_VERSION } from './auto-policy';
import { rankAutoActions } from './auto-utility';

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
function fixture(
  skillIds = ['heal', 'revive', 'strike', 'capture'],
  definitions = skills,
) {
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
    skills: definitions,
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

describe('通用效用策略与观察边界', () => {
  it('资源蓄积只计算未溢出的收益，满资源不会重复蓄积', () => {
    const charge: SkillDef = {
      id: 'charge',
      name: '蓄势',
      tags: ['support'],
      targeting: { side: 'self' },
      effects: [{ type: 'modifyResource', resourceId: 'energy', amount: 100 }],
    };
    const battle = fixture(['charge'], [charge]);
    battle.unit('player').resources = [
      { id: 'energy', name: '能量', current: 0, max: 100 },
    ];
    const choose = () =>
      automaticCommands(battle.snapshot(), 'player', [charge], (id) =>
        battle.queryCommands(id),
      )[0].command;
    expect(choose()).toMatchObject({ type: 'skill', skillId: 'charge' });
    battle.unit('player').resources[0].current = 100;
    expect(choose().type).toBe('attack');
  });
  for (const type of ['attack', 'defend', 'ruleset', 'automatic'] as const) {
    it(`NPC 的旧 ${type} 配置统一接入效用策略，玩家手动防御保留`, () => {
      const strong: SkillDef = {
        id: 'strong',
        name: '强击',
        tags: ['spell'],
        targeting: { side: 'enemy' },
        effects: [{ type: 'fixedHit', power: 600 }],
      };
      const attrs = {
        hp: 1000,
        maxHp: 1000,
        mp: 100,
        maxMp: 100,
        speed: 50,
        physicalAtk: 50,
        physicalDef: 50,
      };
      const host = new CombatV6PveHostSession({
        playerId: 'player',
        npcStrategies: { enemy: { type } },
        sourceProjectionVersions: COMBAT_V6_PHASE_6D_VERSIONS,
        battleInput: {
          seed: 1,
          ruleset: daoyouRulesetV6,
          versions: {
            ...COMBAT_V6_PHASE_6D_VERSIONS,
            autoPolicyVersion: AUTO_POLICY_VERSION,
          },
          skills: [strong],
          units: [
            { id: 'player', name: '玩家', kind: 'player', side: 0, attrs },
            {
              id: 'enemy',
              name: '敌人',
              kind: 'npc',
              side: 1,
              attrs,
              skills: ['strong'],
            },
          ],
        },
      });
      host.submit('player', { type: 'defend' });
      host.resolveRound();
      expect(
        host.state.units.find((unit) => unit.id === 'enemy')?.lastCommand,
      ).toMatchObject({ type: 'skill', skillId: 'strong' });
      expect(
        host.state.units.find((unit) => unit.id === 'player')?.lastCommand,
      ).toEqual({ type: 'defend' });
    });
  }

  it('群体随机分支不会按每个目标重复展开整组效果', () => {
    const base: SkillDef = {
      id: 'area',
      name: '群攻',
      tags: ['spell'],
      targeting: { side: 'enemy', mode: 'all', count: 2 },
      effects: [
        {
          type: 'fixedHit',
          power: 100,
          targeting: { side: 'enemy', mode: 'all' },
        },
      ],
    };
    const random: SkillDef = {
      ...base,
      id: 'random-area',
      effects: [
        {
          type: 'randomBranch',
          branchId: 'always',
          chance: 1,
          successEffects: base.effects,
          failureEffects: [],
        },
      ],
    };
    const battle = fixture(['area', 'random-area'], [base, random]);
    const snapshot = battle.snapshot();
    snapshot.units.find((unit) => unit.id === 'ally')!.side = 1;
    const observation = observeAutoBattle(snapshot, 'player', []);
    const options = battle.queryCommands('player');
    for (const option of options.skills) {
      option.selectableTargetIds = ['enemy', 'ally'];
      option.targetCount = 2;
    }
    const candidates = rankAutoActions(
      observation,
      'player',
      [base, random],
      [],
      options,
    );
    const skillScore = (id: string) =>
      candidates.find(
        (c) => c.command.type === 'skill' && c.command.skillId === id,
      )!.score;
    expect(skillScore('random-area')).toBe(skillScore('area'));
  });
  it('改变敌方隐藏属性、技能、指令和 RNG，不影响观察和评分', () => {
    const battle = fixture();
    const before = battle.snapshot();
    const changed = structuredClone(before);
    const enemy = changed.units.find((unit) => unit.id === 'enemy')!;
    enemy.attrs.hp *= 100;
    enemy.attrs.maxHp *= 100;
    enemy.attrs.mp *= 10;
    enemy.attrs.maxMp *= 10;
    enemy.attrs.physicalDef = 999999;
    enemy.attrs.magicDef = 999999;
    enemy.skills = ['secret'];
    enemy.skillOverrides = { secret: skills[0] };
    enemy.command = { type: 'skill', skillId: 'secret', targets: ['player'] };
    enemy.lastCommand = { type: 'attack', target: 'player' };
    enemy.flags.defending = true;
    changed.rngState++;
    const observation = observeAutoBattle(before, 'player', []);
    const after = observeAutoBattle(changed, 'player', []);
    expect(after).toEqual(observation);
    expect(
      rankAutoActions(
        after,
        'player',
        skills,
        [],
        battle.queryCommands('player'),
      ),
    ).toEqual(
      rankAutoActions(
        observation,
        'player',
        skills,
        [],
        battle.queryCommands('player'),
      ),
    );
    enemy.attrs.hp /= 2;
    expect(observeAutoBattle(changed, 'player', [])).not.toEqual(observation);
  });

  it('策略权重改变治疗与进攻取舍，合法候选保持一致', () => {
    const battle = fixture(['heal', 'strike']);
    battle.unit('ally').attrs.hp = 800;
    const observation = observeAutoBattle(battle.snapshot(), 'player', []);
    const choosePolicy = (policy: 'aggressive' | 'conservative') =>
      rankAutoActions(
        observation,
        'player',
        skills,
        [],
        battle.queryCommands('player'),
        policy,
      );
    const aggressive = choosePolicy('aggressive');
    const conservative = choosePolicy('conservative');
    expect(aggressive[0].command).toMatchObject({
      type: 'skill',
      skillId: 'strike',
    });
    expect(conservative[0].command).toMatchObject({
      type: 'skill',
      skillId: 'heal',
    });
    expect(aggressive.map((c) => JSON.stringify(c.command)).sort()).toEqual(
      conservative.map((c) => JSON.stringify(c.command)).sort(),
    );
  });

  it('随机分支按概率估算，不把不可能发生的收益算进去', () => {
    const random: SkillDef = {
      id: 'random',
      name: '随机术',
      tags: ['spell'],
      targeting: { side: 'enemy' },
      effects: [
        {
          type: 'randomBranch',
          branchId: 'coin',
          chance: 0,
          successEffects: [{ type: 'fixedHit', power: 100000 }],
          failureEffects: [],
        },
      ],
    };
    const battle = fixture(['random'], [random]);
    const result = automaticCommands(
      battle.snapshot(),
      'player',
      [random],
      (id) => battle.queryCommands(id),
    );
    expect(result[0].command.type).toBe('attack');
  });

  it('普攻优于高耗低收益技能，不能只因技能可用就施放', () => {
    const weak: SkillDef = {
      ...skills[2],
      id: 'weak',
      costMp: 90,
      effects: [{ type: 'fixedHit', power: 1 }],
    };
    const battle = fixture(['weak'], [weak]);
    expect(
      automaticCommands(battle.snapshot(), 'player', [weak], (id) =>
        battle.queryCommands(id),
      )[0].command.type,
    ).toBe('attack');
  });

  it('人物与灵兽减少重复控制，不把尚未命中当作实际状态', () => {
    const seal: SkillDef = {
      id: 'seal',
      name: '封印',
      tags: ['spell'],
      targeting: { side: 'enemy' },
      effects: [{ type: 'applyStatus', statusId: 'sealed', duration: 3 }],
    };
    const definitions = [
      {
        id: 'sealed',
        name: '封印',
        kind: 'seal',
        category: 'control' as const,
        blocksAction: true,
      },
    ];
    const battle = fixture(['seal'], [seal]);
    battle.unit('pet').skills = ['seal'];
    const observation = observeAutoBattle(
      battle.snapshot(),
      'player',
      definitions,
    );
    const first = rankAutoActions(
      observation,
      'player',
      [seal],
      definitions,
      battle.queryCommands('player'),
    )[0];
    expect(first.command).toMatchObject({ type: 'skill', skillId: 'seal' });
    const independent = rankAutoActions(
      observation,
      'pet',
      [seal],
      definitions,
      battle.queryCommands('pet'),
    )[0];
    const coordinated = rankAutoActions(
      observation,
      'pet',
      [seal],
      definitions,
      battle.queryCommands('pet'),
      'balanced',
      first.intents,
    ).find((candidate) => candidate.command.type === 'skill')!;
    expect(coordinated.score).toBeLessThan(independent.score);
    expect(coordinated.score).toBeGreaterThan(0);
    expect(battle.unit('enemy').statuses).toEqual([]);
  });

  it('公开禁复活状态阻止无效救援；已有同类控制不重复施加', () => {
    const battle = fixture();
    const snapshot = battle.snapshot();
    const ally = snapshot.units.find((unit) => unit.id === 'ally')!;
    ally.attrs.hp = 0;
    ally.flags.downed = true;
    ally.statuses = [
      {
        id: 'blocked',
        kind: 'blocked',
        remainingRounds: 3,
        sourceId: 'enemy',
        appliedRound: 1,
        speedMod: 0,
        attrMods: {},
        damageTakenPhysical: 1,
        damageTakenSpell: 1,
        healTaken: 1,
        healDealt: 1,
        stacks: 1,
      },
    ];
    const definitions = [
      { id: 'blocked', name: '禁复活', kind: 'blocked', blocksRevive: true },
    ];
    const candidates = rankAutoActions(
      observeAutoBattle(snapshot, 'player', definitions),
      'player',
      skills,
      definitions,
      battle.queryCommands('player'),
    );
    expect(candidates[0].command).not.toMatchObject({
      type: 'skill',
      skillId: 'revive',
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
        manuals: { version: 1, revision: 0, learned: [], build: { slots: [] } },
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
