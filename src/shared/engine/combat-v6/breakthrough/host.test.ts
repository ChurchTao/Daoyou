import type { CultivatorCondition } from '@shared/types/condition';
import { describe, expect, it } from 'vitest';
import { generateStarterBeast } from '../beasts';
import { COMBAT_V6_SECT_DEFINITIONS_V4 } from '../content';
import type { CombatV6TrainingPlayerInput } from '../encounter';
import {
  BREAKTHROUGH_CHALLENGES,
  BreakthroughHost,
  createBreakthroughHost,
  type BreakthroughChallengeId,
} from './host';

function player(id: string): CombatV6TrainingPlayerInput {
  const definition = COMBAT_V6_SECT_DEFINITIONS_V4.youdu;
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
    manuals: { version: 1, revision: 0, build: { slots: [] } },
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
  it('镜像使用独立 ID 和满状态，清心只改变心魔难度，不修改玩家', () => {
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
    const host = createBreakthroughHost(input, 'tribulation_deity', true, 1);
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
  it('旧版本快照不能冒充突破试炼', () => {
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
