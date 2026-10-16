import { BREAKTHROUGH_CHALLENGES } from '@daoyou/game-content/combat/breakthrough';
import { COMBAT_V6_SECT_DEFINITIONS } from '@daoyou/game-content/sects';
import type { CombatV6TrainingPlayerInput } from '@daoyou/game-domain/combat';
import { type BreakthroughChallengeId } from '@daoyou/game-domain/combat/challenges';
import type { CultivatorCondition } from '@daoyou/game-domain/condition';
import { describe, expect, it } from 'vitest';
import { generateStarterBeast } from '../../beasts/generator.js';
import { towerReferenceBuild } from '../../tower/reference-fixtures.js';
import { automaticCommands } from '../auto.js';
import { projectCharacterToCombatV6 } from '../projection/project-character.js';
import { BreakthroughHost, createBreakthroughHost } from './host.js';

function player(id: string): CombatV6TrainingPlayerInput {
  const definition = COMBAT_V6_SECT_DEFINITIONS.youdu;
  const track = { level: 0, progress: 0 };
  const condition: CultivatorCondition = {
    version: 1,
    resources: { hp: { current: 100 }, mp: { current: 0 } },
    gauges: { pillToxicity: 0 },
    tracks: {
      tempering: {
        vitality: track,
        spirit: track,
        wisdom: track,
        speed: track,
        willpower: track,
      },
      marrowWash: track,
    },
    counters: {
      longTermPillUsesByRealm: {},
      cultivationPillUsesByRealm: {},
      longevityPillUsesByRealm: {},
    },
    statuses: [],
    timestamps: { lastRecoveryAt: '2026-09-08T00:00:00.000Z' },
  };
  return {
    cultivator: {
      id,
      name: id,
      realm: '炼气',
      realm_stage: '后期',
      attributes: {
        vitality: 10,
        strength: 10,
        spirit: 10,
        endurance: 10,
        speed: 10,
        willpower: 10,
      },
      condition,
    },
    sect: {
      version: 1,
      sectId: 'youdu',
      methods: Object.fromEntries(definition.methods.map((m) => [m.id, 1])),
      activePathId: definition.paths[0].id,
      meridianDepth: 0,
      meridianLoadouts: definition.paths.map((p) => ({
        pathId: p.id,
        nodeIds: [],
        revision: 0,
      })) as CombatV6TrainingPlayerInput['sect']['meridianLoadouts'],
    },
    equipment: {},
    manuals: { version: 1, revision: 0, learned: [], build: { slots: [] } },
  };
}

describe('突破试炼普通 V6 战斗', () => {
  for (const id of Object.keys(
    BREAKTHROUGH_CHALLENGES,
  ) as BreakthroughChallengeId[]) {
    it(`${id} 同场冻结、保存恢复后指令及随机数一致`, () => {
      const input = player('player');
      const before = structuredClone(input);
      const host = createBreakthroughHost(input, id, true, 31);
      const snapshot = host.runtimeSnapshot();
      input.cultivator.attributes.strength = 10000;
      expect(host.runtimeSnapshot()).toEqual(snapshot);
      expect(snapshot.input.units[0].attrs).toMatchObject({ hp: 100, mp: 0 });
      const restored = new BreakthroughHost(snapshot, snapshot);
      host.submit(host.playerId, { type: 'defend' });
      restored.submit(restored.playerId, { type: 'defend' });
      host.resolveRound();
      restored.resolveRound();
      expect(restored.runtimeSnapshot()).toEqual(host.runtimeSnapshot());
      expect(host.trace().rounds).toHaveLength(1);
      expect(before.cultivator.condition!.resources.hp.current).toBe(100);
    });
  }
  it('固定心魔使用独立 ID 和满状态，清心只改变心魔难度，不修改玩家', () => {
    const input = player('player');
    const before = structuredClone(input);
    const clear = createBreakthroughHost(input, 'heart_demon_nascent', true, 1);
    const hard = createBreakthroughHost(input, 'heart_demon_nascent', false, 1);
    const enemy = clear.state.units.find((u) => u.side === 1)!;
    expect(enemy.id).not.toBe(clear.playerId);
    expect(enemy.attrs.hp).toBe(enemy.attrs.maxHp);
    expect(enemy.attrs.mp).toBe(enemy.attrs.maxMp);
    expect(
      hard.state.units.find((u) => u.side === 1)!.attrs.maxHp,
    ).toBeGreaterThan(enemy.attrs.maxHp);
    expect(input).toEqual(before);
    expect(
      clear.queryCommands().skills.some((s) => s.skillId.includes('capture')),
    ).toBe(false);
  });
  it('玩家提高装备、六维和心法时，突破敌人不跟着上涨', () => {
    for (const id of Object.keys(
      BREAKTHROUGH_CHALLENGES,
    ) as BreakthroughChallengeId[]) {
      const input = towerReferenceBuild(
        'lingxiao',
        BREAKTHROUGH_CHALLENGES[id].fromRealm,
        '圆满',
      );
      const first = createBreakthroughHost(
        input,
        id,
        true,
        1,
      ).runtimeSnapshot();
      input.cultivator.attributes.strength += 500;
      input.equipment = {};
      input.sect.methods = Object.fromEntries(
        Object.keys(input.sect.methods).map((key) => [key, 1]),
      );
      const second = createBreakthroughHost(
        input,
        id,
        true,
        1,
      ).runtimeSnapshot();
      expect(second.input.units.find((unit) => unit.side === 1)).toEqual(
        first.input.units.find((unit) => unit.side === 1),
      );
      expect(
        second.input.unitAppearances?.[`breakthrough.enemy.${id}`]?.icon,
      ).toBe(`icon:breakthrough-${id}`);
    }
  });
  it('存量 v1 战斗按冻结的敌人和技能恢复，不套用新强度', () => {
    const initial = createBreakthroughHost(
      player('player'),
      'heart_demon_nascent',
      true,
      31,
    ).runtimeSnapshot();
    initial.input.versions!.contentVersion = 'combat-v6-breakthrough-v1';
    const enemy = initial.input.units.find((unit) => unit.side === 1)!;
    enemy.name = '旧心魔';
    enemy.attrs!.hp = enemy.attrs!.maxHp = 777;
    enemy.skills = ['beast.spirit-flame'];
    enemy.passives = [];
    enemy.skillLevels = { 'beast.spirit-flame': 15 };
    const old = new BreakthroughHost(initial);
    const snapshot = old.runtimeSnapshot();
    const restored = new BreakthroughHost(snapshot, snapshot);
    old.submit(old.playerId, { type: 'defend' });
    restored.submit(restored.playerId, { type: 'defend' });
    old.resolveRound();
    restored.resolveRound();
    expect(restored.runtimeSnapshot()).toEqual(old.runtimeSnapshot());
    expect(
      restored.runtimeSnapshot().input.units.find((unit) => unit.side === 1)
        ?.attrs?.maxHp,
    ).toBe(777);
  });
  it('八场突破实际执行各自的技能、低血反扑、雷甲、破绽与耗蓝机制', () => {
    for (const id of Object.keys(
      BREAKTHROUGH_CHALLENGES,
    ) as BreakthroughChallengeId[]) {
      const initial = createBreakthroughHost(
        referenceBuild(id, 'lingxiao', 0, true),
        id,
        true,
        31,
      ).runtimeSnapshot();
      for (const unit of initial.input.units) {
        if (unit.side === 1)
          unit.attrs!.hp = Math.round(unit.attrs!.maxHp! * 0.2);
      }
      const host = new BreakthroughHost(initial);
      host.submitGroup(
        host.state.units
          .filter((unit) => unit.side === 0 && !unit.flags.benched)
          .map((unit) => ({
            unitId: unit.id,
            command: { type: 'defend' as const },
          })),
      );
      host.resolveRound();
      const trace = host.trace();
      const enemyId = `breakthrough.enemy.${id}`;
      expect(
        trace.events.some((event) => {
          if (event.type !== 'actionStart' || event.unitId !== enemyId)
            return false;
          const command = event.command;
          return (
            command.type === 'skill' &&
            BREAKTHROUGH_CHALLENGES[id].skills.some(
              (skill) => skill === command.skillId,
            )
          );
        }),
        `${id}/${JSON.stringify(trace.rounds)}`,
      ).toBe(true);
      const enemy = host.state.units.find((unit) => unit.id === enemyId)!;
      if (id === 'heart_demon_nascent')
        expect(
          enemy.statuses.some(
            (status) => status.kind === 'breakthrough.obsession',
          ),
        ).toBe(true);
      if (id === 'tribulation_body')
        expect(
          enemy.statuses.some(
            (status) => status.kind === 'breakthrough.thunder-shell',
          ),
        ).toBe(true);
      if (id === 'law_insight_void')
        expect(
          enemy.statuses.some(
            (status) => status.kind === 'breakthrough.rift-exposed',
          ),
        ).toBe(true);
      if (id === 'heavenly_tribulation_final')
        expect(
          enemy.statuses.some(
            (status) => status.kind === 'breakthrough.last-chime',
          ),
        ).toBe(true);
      if (id === 'inner_demon_grand') {
        expect(
          trace.events.some(
            (event) => event.type === 'mpDamage' && event.sourceId === enemyId,
          ),
        ).toBe(true);
        expect(
          host.state.units.some(
            (unit) =>
              unit.side === 0 &&
              unit.statuses.some(
                (status) => status.kind === 'breakthrough.empty-casket',
              ),
          ),
        ).toBe(true);
      }
      if (id === 'tribulation_deity' || id === 'heavenly_tribulation_final') {
        expect(
          new Set(
            trace.events
              .filter(
                (event) =>
                  event.type === 'damage' && event.sourceId === enemyId,
              )
              .map((event) => event.type === 'damage' && event.targetId),
          ).size,
        ).toBe(2);
      }
    }
  });
  it('首发和后备灵兽沿用普通阵容及指令，没有试炼专属禁用', () => {
    const owner = '10000000-0000-4000-8000-000000000001';
    const input = player(owner);
    const beasts = [1, 2].map((i) =>
      generateStarterBeast(
        `20000000-0000-4000-8000-00000000000${i}`,
        owner,
        'combat.wild.species.spirit-fox',
        i,
      ),
    );
    input.beasts = {
      beasts,
      lineup: {
        carriedBeastIds: beasts.map((b) => b.id),
        leadBeastId: beasts[0].id,
        revision: 0,
      },
    };
    const snapshot = createBreakthroughHost(
      input,
      'tribulation_deity',
      true,
      1,
    ).runtimeSnapshot();
    // This test covers summoning, independent of the newly calibrated enemy damage.
    snapshot.input.units.find((unit) => unit.side === 1)!.attrs.physicalAtk = 1;
    snapshot.input.units.find((unit) => unit.side === 1)!.attrs.magicAtk = 1;
    const host = new BreakthroughHost(snapshot);
    expect(host.controlledCommandOptions()).toHaveLength(2);
    expect(host.state.units.filter((u) => u.kind === 'pet')).toHaveLength(2);
    host.submitGroup([
      {
        unitId: host.playerId,
        command: { type: 'summon', petId: `beast:${beasts[1].id}` },
      },
      { unitId: `beast:${beasts[0].id}`, command: { type: 'defend' } },
    ]);
    host.resolveRound();
    expect(
      host.state.units.find((u) => u.id === `beast:${beasts[1].id}`)!.flags
        .benched,
    ).toBe(false);
    expect(
      host.state.units.find((u) => u.id === `beast:${beasts[0].id}`)!.flags
        .benched,
    ).toBe(true);
  });
  it('其他玩法快照不能冒充突破试炼', () => {
    const host = createBreakthroughHost(
      player('player'),
      'law_insight_void',
      true,
      1,
    );
    const snapshot = host.runtimeSnapshot();
    snapshot.input.versions!.contentVersion = 'combat-v6-sect-task-v1';
    expect(() => new BreakthroughHost(snapshot, snapshot)).toThrow('版本');
  });
  it('普通回合上限为百回合，双方未胜时返回平局', () => {
    const initial = createBreakthroughHost(
      player('player'),
      'tribulation_body',
      true,
      9,
    ).runtimeSnapshot();
    for (const unit of initial.input.units) {
      unit.attrs = {
        ...unit.attrs,
        hp: 100000000,
        maxHp: 100000000,
        mp: 0,
        maxMp: 0,
        physicalAtk: 1,
        magicAtk: 1,
      };
      unit.skills = [];
    }
    const host = new BreakthroughHost(initial);
    for (let round = 0; round < 100; round++) {
      expect(host.finished).toBe(false);
      host.submit(host.playerId, { type: 'defend' });
      host.resolveRound();
    }
    expect(host.finished).toBe(true);
    expect(host.trace().outcome).toBe('draw');
  });
});

function referenceBuild(
  id: BreakthroughChallengeId,
  sectId: keyof typeof COMBAT_V6_SECT_DEFINITIONS,
  path: 0 | 1,
  trained: boolean,
) {
  const input = towerReferenceBuild(
    sectId,
    BREAKTHROUGH_CHALLENGES[id].fromRealm,
    '圆满',
    path,
  );
  if (!trained) {
    input.equipment = {};
    input.beasts = undefined;
    input.cultivator.condition!.tracks.bodyCultivation = undefined;
    input.sect.methods = Object.fromEntries(
      Object.keys(input.sect.methods).map((key) => [key, 1]),
    );
  }
  const projected = projectCharacterToCombatV6({
    ...input,
    side: 0,
    slot: 0,
    resourcePolicy: 'full',
  });
  if (!projected.ok) throw new Error('突破定标构筑无效');
  input.cultivator.condition!.resources = {
    hp: { current: projected.unit.attrs!.maxHp! },
    mp: { current: projected.unit.attrs!.maxMp! },
  };
  return input;
}

function complete(host: BreakthroughHost) {
  for (let turn = 0; turn < 100 && !host.finished; turn++) {
    const input = host.runtimeSnapshot().input;
    host.submitGroup(
      automaticCommands(
        host.state,
        host.playerId,
        input.skills ?? [],
        (id) => host.queryCommands(id),
        { statusDefs: input.statusDefs },
      ),
    );
    host.resolveRound();
  }
  const trace = host.trace();
  return { outcome: trace.outcome, rounds: trace.rounds.length };
}

describe('突破养成门槛', () => {
  for (const id of Object.keys(
    BREAKTHROUGH_CHALLENGES,
  ) as BreakthroughChallengeId[]) {
    for (const sectId of Object.keys(COMBAT_V6_SECT_DEFINITIONS) as Array<
      keyof typeof COMBAT_V6_SECT_DEFINITIONS
    >) {
      for (const path of [0, 1] as const) {
        it(`${id}/${sectId}/${path} 普通白装、心法及普通灵兽可过，未养成不能稳定通过`, () => {
          const trained = referenceBuild(id, sectId, path, true);
          const untrained = referenceBuild(id, sectId, path, false);
          const results = [1, 31, 97].map((seed) =>
            complete(createBreakthroughHost(trained, id, true, seed)),
          );
          const weak = [1, 31, 97].map((seed) =>
            complete(createBreakthroughHost(untrained, id, true, seed)),
          );
          expect(
            weak.filter((result) => result.outcome === 'victory').length,
            JSON.stringify(weak),
          ).toBe(0);
          expect(
            results.filter((result) => result.outcome === 'victory').length,
            JSON.stringify(results),
          ).toBeGreaterThanOrEqual(2);
          expect(
            results
              .filter((result) => result.outcome === 'victory')
              .every((result) => result.rounds >= 3 && result.rounds <= 30),
            JSON.stringify(results),
          ).toBe(true);
        }, 20000);
      }
    }
  }
});
