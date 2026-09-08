import { describe, expect, it } from 'vitest';
import {
  ARENA_PUBLIC_VIEW,
  ARENA_V6_PROTOCOL,
  ArenaV6SubmitSchema,
  type ArenaRuntime,
} from '../contracts/combatV6Arena';
import {
  parseCombatV6Replay,
  type CombatV6ReplayV1,
} from '../contracts/combatV6Runtime';
import { EffectType, SkillTag, TargetSide } from '../engine/combat-v6/core';
import {
  arenaBattle,
  arenaDefaultCommand,
  arenaEvents,
  arenaUnits,
  arenaView,
  arenaWaitingUnits,
  resolveArena,
  validateArenaCommand,
} from './arena';
import { automaticCommands } from './auto';
import { applyUnitDelta, contiguousEvents } from './playback';
import { combatV6ReplayView, createCombatV6Replay } from './replay';

function fixture(count = 8): ArenaRuntime {
  const units = Array.from({ length: count }, (_, i) => ({
    id: `u${i}`,
    name: `人物${i}`,
    kind: 'player' as const,
    side: (i % 2) as 0 | 1,
    slot: Math.floor(i / 2),
    attrs: {
      hp: 12345 + i,
      mp: 567 + i,
      physicalAtk: 200,
      physicalDef: 100,
      speed: 50,
    },
    skills: [`s${i}`],
  }));
  const skills = units.map((u, i) => ({
    id: `s${i}`,
    name: `私有技能${i}`,
    tags: [SkillTag.Support],
    targeting: { side: TargetSide.Self },
    costMp: 900,
    effects: [{ type: EffectType.Heal, power: 100 }],
  }));
  const input = { units, skills, statusDefs: [], seed: 64 };
  const battle = arenaBattle(input);
  return {
    ...input,
    protocol: ARENA_V6_PROTOCOL,
    battleId: 'arena',
    roomId: 'room',
    startRequestId: 'start',
    participants: units.map((u) => ({
      userId: u.id,
      cultivatorId: u.id,
      unitId: u.id,
      side: u.side,
      slot: u.slot,
    })),
    state: battle.snapshot(),
    events: [...battle.log()],
    rounds: [],
    revision: 0,
    stage: 'collecting',
    createdAt: 0,
    expiresAt: 7200000,
    deadlineAt: 30000,
    playbackEndsAt: 0,
    commands: {},
    receipts: {},
    lastResults: {},
  };
}

describe('arena public host', () => {
  it('AUTO 只为本人和在场灵兽生成普通合法指令', () => {
    const runtime = fixture(4);
    runtime.units.push({
      id: 'pet',
      name: '灵兽',
      kind: 'pet',
      ownerId: 'u0',
      side: 0,
      slot: 4,
      attrs: { hp: 100, speed: 1 },
    });
    runtime.state = arenaBattle({ ...runtime, state: undefined }).snapshot();
    const before = structuredClone(runtime);
    const battle = arenaBattle(runtime);
    const commands = automaticCommands(
      runtime.state,
      'u0',
      runtime.skills,
      (id) => battle.queryCommands(id),
    );
    expect(commands.map((c) => c.unitId)).toEqual(['u0', 'pet']);
    for (const entry of commands)
      expect(() =>
        validateArenaCommand(runtime, entry.unitId, entry.command),
      ).not.toThrow();
    expect(runtime).toEqual(before);
  });

  it('AUTO 请求协议可解析，回放只记录展开后的实际指令', () => {
    const input = ArenaV6SubmitSchema.parse({
      round: 1,
      requestId: '10000000-0000-4000-8000-000000000001',
      commands: 'AUTO',
    });
    const runtime = fixture(2);
    const battle = arenaBattle(runtime);
    for (const p of runtime.participants) {
      const commands = automaticCommands(
        runtime.state,
        p.unitId,
        runtime.skills,
        (id) => battle.queryCommands(id),
      );
      for (const entry of commands)
        runtime.commands[entry.unitId] = {
          requestId: input.requestId,
          command: entry.command,
        };
    }
    runtime.stage = 'resolving';
    const result = resolveArena(runtime, 4000);
    expect(result.rounds[0].commands).toHaveLength(2);
    expect(
      result.rounds[0].commands.every(
        (entry) => entry.command.type === 'attack',
      ),
    ).toBe(true);
    expect(
      arenaView(result, ARENA_PUBLIC_VIEW, 4000).commandOptions,
    ).toBeUndefined();
  });

  it('4v4每人六只携带只展示一宠，16个行动且观众不获得替补或控制信息', () => {
    const runtime = fixture();
    const players = [...runtime.units];
    for (const player of players)
      for (let i = 0; i < 6; i++)
        runtime.units.push({
          id: `${player.id}:pet:${i}`,
          name: `灵兽${player.id}:${i}`,
          kind: 'pet',
          ownerId: player.id,
          side: player.side,
          slot: player.slot,
          benched: i > 0,
          attrs: { hp: 1000, speed: 1, physicalAtk: 1 },
        });
    const battle = arenaBattle({
      seed: runtime.seed,
      units: runtime.units,
      skills: runtime.skills,
      statusDefs: runtime.statusDefs,
    });
    runtime.state = battle.snapshot();
    runtime.events = [...battle.log()];
    expect(runtime.state.units).toHaveLength(56);
    const view = arenaView(runtime, 'u0', 0);
    expect(view.units).toHaveLength(16);
    expect(view.controlledCommandOptions?.map((o) => o.unitId)).toEqual([
      'u0',
      'u0:pet:0',
    ]);
    expect(view.controlledCommandOptions?.[0].summonablePets).toHaveLength(5);
    const publicView = arenaView(runtime, ARENA_PUBLIC_VIEW, 0);
    expect(publicView.controlledCommandOptions).toBeUndefined();
    expect(Object.keys(publicView.display.unitNames ?? {})).toHaveLength(16);
    expect(publicView.units.every((u) => u.publicBars && !u.attributes)).toBe(
      true,
    );
    const next = resolveArena(runtime, 0);
    const publicResult = next.lastResults[ARENA_PUBLIC_VIEW];
    expect(next.rounds[0].commands).toHaveLength(16);
    let shown = publicView.units;
    for (const frame of publicResult.playback!.frames)
      shown = applyUnitDelta(shown, frame);
    expect(shown).toEqual(publicResult.units);
  });
  it('provides spectator deltas with no control, private attributes or uncast skills', () => {
    const runtime = fixture();
    runtime.skills = runtime.skills.map((s) => ({ ...s, costMp: 0 }));
    runtime.commands.u0 = {
      requestId: 'private',
      command: { type: 'skill', skillId: 's0', targets: ['u0'] },
    };
    const initial = arenaView(runtime, ARENA_PUBLIC_VIEW, 0);
    expect(initial.spectator).toBe(true);
    expect(initial.commandOptions).toBeUndefined();
    expect(initial.pendingCommand).toBeUndefined();
    expect(initial.display.skills).toEqual({});
    expect(
      initial.units.every(
        (u) => u.publicBars && !u.attributes && u.resources.length === 0,
      ),
    ).toBe(true);
    expect(
      initial.events.some(({ event }) => event.type === 'commandAccepted'),
    ).toBe(false);
    const next = resolveArena(runtime, 1000);
    const view = next.lastResults[ARENA_PUBLIC_VIEW];
    let shown = initial.units;
    for (const frame of view.playback!.frames)
      shown = applyUnitDelta(shown, frame);
    expect(shown).toEqual(view.units);
    expect(view.units.map((u) => u.side)).toEqual(
      next.state.units.map((u) => u.side),
    );
    expect(view.display.skills.s0).toBe('私有技能0');
    expect(view.commandOptions).toBeUndefined();
    expect(() => arenaView(runtime, 'unauthorized', 0)).toThrow(
      'ARENA_FORBIDDEN',
    );
  });
  it('archives consecutive rounds once and reproduces each participant live delta view', () => {
    let runtime = fixture();
    const id = 'c431d125-c61d-423a-9b2d-dde9dd94daac';
    runtime.participants = runtime.participants.map((p, i) => ({
      ...p,
      cultivatorId: `c431d125-c61d-423a-9b2d-dde9dd94daa${i}`,
    }));
    runtime = resolveArena(runtime, 0);
    const firstFrameCount = runtime.timeline!.frames.length;
    runtime.stage = 'collecting';
    runtime = resolveArena(runtime, 30000);
    const replay = createCombatV6Replay({
      battleId: id,
      participants: runtime.participants,
      metadata: {
        schemaVersion: 1,
        sourceType: 'arena-sparring',
        battleType: 'pvp',
        idempotencyKey: id,
        payload: { roomId: 'room' },
      },
      startedAt: new Date(0).toISOString(),
      finishedAt: new Date(60000).toISOString(),
      reason: 'expired',
      trace: {
        ...runtime,
        initialUnits: runtime.units,
        finalState: runtime.state,
      },
    });
    for (const p of runtime.participants) {
      const view = combatV6ReplayView(replay, p.cultivatorId, p.userId);
      expect(view.timeline!.frames.slice(firstFrameCount)).toEqual(
        runtime.lastResults[p.unitId].playback!.frames,
      );
      let units = view.timeline!.initialUnits;
      for (const frame of view.timeline!.frames)
        units = applyUnitDelta(units, frame);
      expect(units).toEqual(runtime.lastResults[p.unitId].units);
      expect(units.find((u) => u.id === p.unitId)?.side).toBe(0);
    }
  });
  it('uses one strict archive for PvE and PvP, without host or delivery state', () => {
    const runtime = fixture();
    const id = 'c431d125-c61d-423a-9b2d-dde9dd94daac';
    const participants = runtime.participants.map((p, i) => ({
      ...p,
      cultivatorId: `c431d125-c61d-423a-9b2d-dde9dd94daa${i}`,
    }));
    const trace = {
      ...runtime,
      initialUnits: runtime.units,
      finalState: runtime.state,
    };
    const sources: CombatV6ReplayV1['metadata'][] = [
      {
        schemaVersion: 1,
        sourceType: 'training-room',
        battleType: 'training',
        idempotencyKey: id,
        payload: { encounterId: 'dummy', tier: 60 },
      },
      {
        schemaVersion: 1,
        sourceType: 'wild-encounter',
        battleType: 'pve',
        idempotencyKey: id,
        payload: {
          nodeId: 'SAT_TN_08',
          encounterContentVersion: 'v1',
          combatants: [{ unitId: 'u1', speciesId: 'wolf', level: 5 }],
        },
      },
      {
        schemaVersion: 1,
        sourceType: 'arena-sparring',
        battleType: 'pvp',
        idempotencyKey: id,
        payload: { roomId: 'arena-room' },
      },
    ];
    const replays = sources.map((metadata) =>
      createCombatV6Replay({
        battleId: id,
        participants:
          metadata.battleType === 'pvp'
            ? participants
            : participants.slice(0, 1),
        metadata,
        trace,
        reason: 'expired',
        startedAt: new Date(0).toISOString(),
        finishedAt: new Date(30000).toISOString(),
      }),
    );
    for (const replay of replays) {
      expect(Object.keys(replay)).toEqual(Object.keys(replays[0]));
      expect(replay.outcome).toBe('aborted');
      expect(replay.finalState).toEqual(runtime.state);
      expect(parseCombatV6Replay(JSON.parse(JSON.stringify(replay)))).toEqual(
        replay,
      );
      for (const key of [
        'hostVersion',
        'protocol',
        'revision',
        'commands',
        'receipts',
        'lastResults',
        'deadlineAt',
        'cultivatorId',
      ]) {
        expect(replay).not.toHaveProperty(key);
        expect(() =>
          parseCombatV6Replay({ ...replay, [key]: 'legacy' }),
        ).toThrow();
      }
    }
    expect(() => parseCombatV6Replay(runtime)).toThrow();
    expect(() =>
      parseCombatV6Replay({
        ...replays[2],
        participants: [participants[0], participants[0]],
      }),
    ).toThrow();
    const view = combatV6ReplayView(
      replays[2],
      participants[0].cultivatorId,
      participants[0].userId,
    );
    expect(view.units.filter((u) => u.attributes)).toHaveLength(1);
    expect(view.display.skills).toEqual({ s0: '私有技能0' });
    expect(() =>
      combatV6ReplayView(
        replays[2],
        participants[0].cultivatorId,
        'another-user',
      ),
    ).toThrow();
  });
  it.each([2, 3, 8])(
    '%s participants: deterministic restore and per-viewer delta reconstruction',
    (count) => {
      const runtime = fixture(count);
      const original = structuredClone(runtime);
      const next = resolveArena(runtime, 30000);
      expect(runtime).toEqual(original);
      expect(resolveArena(structuredClone(runtime), 30000)).toEqual(next);
      expect(next.rounds[0].commands).toHaveLength(count);
      expect(
        next.rounds[0].commands.every((c) => c.command.type === 'attack'),
      ).toBe(true);
      for (const participant of runtime.participants) {
        const result = next.lastResults[participant.unitId];
        let units = arenaUnits(runtime.state, runtime, participant.unitId);
        let cursor = result.playback!.fromEventSeq;
        for (const frame of result.playback!.frames) {
          expect(frame.afterEventSeq).toBeGreaterThan(cursor);
          units = applyUnitDelta(units, frame);
          cursor = frame.afterEventSeq;
        }
        expect(units).toEqual(result.units);
        expect(cursor).toBe(result.latestEventSeq);
        expect(contiguousEvents(result.events, -1, cursor)).toBe(true);
      }
    },
  );

  it('hides allied and enemy private stats, commands and unused skill names', () => {
    const runtime = fixture();
    runtime.commands.u2 = {
      requestId: 'private',
      command: { type: 'skill', skillId: 's2', targets: ['u2'] },
    };
    runtime.events.push({
      type: 'commandAccepted',
      unitId: 'u2',
      command: runtime.commands.u2.command,
    });
    const view = arenaView(runtime, 'u0', 0);
    expect(view.submittedUnitIds).toEqual(['u2']);
    expect(view.units[0].hp).toBe(12345);
    for (const unit of view.units.slice(1)) {
      expect(unit.hp).toBe(10000);
      expect(unit.mp).toBe(10000);
      expect(unit.attributes).toBeUndefined();
      expect(unit.resources).toEqual([]);
    }
    expect(Object.keys(view.display!.skills)).toEqual(['s0']);
    expect(JSON.stringify(view)).not.toContain('s2');
    expect(
      arenaView(runtime, 'u1', 0).units.find((u) => u.id === 'u1')!.side,
    ).toBe(0);
    expect(() => arenaView(runtime, 'spectator', 0)).toThrow('ARENA_FORBIDDEN');
  });

  it('strips exact post-action resources, including revival, with a continuous public cursor', () => {
    const events = arenaEvents([
      { type: 'unitRevived', unitId: 'u1', hp: 2469 },
      { type: 'mpCost', unitId: 'u1', amount: 10, mpAfter: 557 },
      {
        type: 'heal',
        sourceId: 'u0',
        targetId: 'u1',
        amount: 25,
        hpAfter: 2494,
      },
    ]);
    expect(events).toEqual([
      { seq: 0, event: { type: 'unitRevived', unitId: 'u1' } },
      {
        seq: 1,
        event: { type: 'heal', sourceId: 'u0', targetId: 'u1', amount: 25 },
      },
    ]);
  });

  it('accepts downed self intents and insufficient MP but rejects unowned skills and wrong targets', () => {
    const runtime = fixture();
    runtime.state.units[0].flags.downed = true;
    runtime.state.units[0].attrs.hp = 0;
    expect(arenaWaitingUnits(runtime).map((u) => u.id)).toContain('u0');
    expect(() =>
      validateArenaCommand(runtime, 'u0', {
        type: 'skill',
        skillId: 's0',
        targets: ['u0'],
      }),
    ).not.toThrow();
    expect(() =>
      validateArenaCommand(runtime, 'u0', {
        type: 'skill',
        skillId: 's1',
        targets: ['u1'],
      }),
    ).toThrow();
    expect(() =>
      validateArenaCommand(runtime, 'u0', { type: 'attack', target: 'u2' }),
    ).toThrow();
    runtime.state.units[0].flags.escaped = true;
    expect(arenaWaitingUnits(runtime).map((u) => u.id)).not.toContain('u0');
  });

  it('defaults explicitly to stable basic attack instead of reusing previous skills', () => {
    const runtime = fixture();
    runtime.state.units[0].lastCommand = {
      type: 'skill',
      skillId: 's0',
      targets: ['u0'],
    };
    const before = structuredClone(runtime.state);
    expect(arenaDefaultCommand(runtime, 'u0')).toEqual({
      type: 'attack',
      target: 'u1',
    });
    expect(runtime.state).toEqual(before);
    expect(
      ArenaV6SubmitSchema.safeParse({
        round: 1,
        requestId: crypto.randomUUID(),
        command: { type: 'auto' },
      }).success,
    ).toBe(false);
  });

  it('stops at round 100 with a draw and rejects mismatched checkpoint versions', () => {
    const runtime = fixture(2);
    runtime.state.round = 100;
    for (const unit of runtime.state.units)
      runtime.commands[unit.id] = {
        requestId: unit.id,
        command: { type: 'defend' },
      };
    const next = resolveArena(runtime, 1000);
    expect(next.stage).toBe('finished');
    expect(next.state.result?.winner).toBe('draw');
    runtime.state.versions = {
      ...runtime.state.versions,
      rulesetVersion: 'daoyou_rules_v5',
    };
    expect(() => arenaBattle(runtime)).toThrow('ARENA_VERSION_MISMATCH');
  });
});
