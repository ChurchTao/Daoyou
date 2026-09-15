import { describe, expect, it } from 'vitest';
import { parseCombatV6Replay } from '../contracts/combatV6Runtime';
import { projectReplayUnits } from './arena';
import { applyUnitDelta } from './playback';
import { combatV6Units } from './presentation';
import {
  presentationBattle,
  presentationScenarios,
} from './presentation-fixtures';
import { combatV6ReplayView, createCombatV6Replay } from './replay';
import {
  replayRound,
  replaySeeker,
  startReplayTimeline,
} from './replay-timeline';

const id = 'c431d125-c61d-423a-9b2d-dde9dd94daac';
function record(scenario: (typeof presentationScenarios)[number]) {
  const { battle, input } = presentationBattle(scenario);
  const statuses = input.statusDefs ?? [];
  const timeline = startReplayTimeline(
    battle.snapshot(),
    statuses,
    battle.log().length - 1,
  );
  const recording = replayRound(
    timeline,
    battle.snapshot(),
    statuses,
    battle.log().length - 1,
  );
  const snapshots = [timeline.initialUnits];
  battle.lockAndResolve((state, seq) => {
    recording.capture(state, seq);
    snapshots.push(combatV6Units(state, statuses));
  });
  recording.finish(battle.snapshot(), battle.log().length - 1);
  snapshots.push(combatV6Units(battle.snapshot(), statuses));
  const replay = createCombatV6Replay({
    battleId: id,
    participants: [
      { userId: 'user', cultivatorId: id, unitId: 'unit-0', side: 0, slot: 0 },
    ],
    metadata: {
      schemaVersion: 1,
      sourceType: 'training-room',
      battleType: 'training',
      idempotencyKey: id,
      payload: { encounterId: 'fixture', tier: 60 },
    },
    startedAt: new Date(0).toISOString(),
    finishedAt: new Date(1000).toISOString(),
    reason: 'expired',
    trace: {
      seed: input.seed!,
      initialUnits: input.units,
      skills: input.skills ?? [],
      statusDefs: statuses,
      rounds: [],
      events: [...battle.log()],
      finalState: battle.snapshot(),
      timeline,
    },
  });
  return { replay, snapshots, battle };
}
describe('historical presentation replay', () => {
  it('seeks a long timeline across evicted checkpoints and equal public cursors', () => {
    const { replay } = record('1v3');
    const timeline = replay.timeline!;
    const unit = timeline.initialUnits[0];
    timeline.frames = Array.from({ length: 1600 }, (_, i) => ({
      afterEventSeq: timeline.fromEventSeq + Math.floor(i / 2),
      round: Math.floor(i / 16) + 1,
      updates: [{ id: unit.id, set: { hp: i } }],
    }));
    const seek = replaySeeker(timeline);
    for (const index of [1600, 0, 33, 1024, 800, 1600, 1]) {
      const position = seek(index);
      expect(position.units[0].hp).toBe(index ? index - 1 : unit.hp);
      expect(position.units[1]).toBe(timeline.initialUnits[1]);
    }
  });
  it.each(presentationScenarios)(
    'reconstructs every observed action, round end and random seek: %s',
    (scenario) => {
      const { replay, snapshots, battle } = record(scenario);
      const parsed = parseCombatV6Replay(JSON.parse(JSON.stringify(replay)));
      expect(parsed.replayVersion).toBe('combat_v6_replay_v2');
      const view = combatV6ReplayView(parsed, id, 'user');
      const seek = replaySeeker(view.timeline!);
      for (let index = 0; index <= view.timeline!.frames.length; index++)
        expect(seek(index).units).toEqual(
          projectReplayUnits(snapshots[index], 'unit-0', 0),
        );
      for (const index of [0, 3, 1, view.timeline!.frames.length, 0])
        expect(seek(index).units).toEqual(
          projectReplayUnits(
            snapshots[Math.min(index, snapshots.length - 1)],
            'unit-0',
            0,
          ),
        );
      expect(seek(view.timeline!.frames.length).units).toEqual(view.units);
      const control = presentationBattle(scenario).battle;
      control.lockAndResolve();
      expect(battle.snapshot()).toEqual(control.snapshot());
      expect(battle.log()).toEqual(control.log());
    },
  );
  it('projects each frame before delivery, preserves own detail, hides other builds', () => {
    const { replay } = record('16-status');
    const view = combatV6ReplayView(replay, id, 'user');
    let units = view.timeline!.initialUnits;
    for (const frame of view.timeline!.frames) {
      units = applyUnitDelta(units, frame);
      for (const unit of units.filter(
        (u) => u.id !== 'unit-0' && u.ownerId !== 'unit-0',
      )) {
        expect(unit.publicBars).toBe(true);
        expect(unit.attributes).toBeUndefined();
        expect(unit.resources).toEqual([]);
        expect(unit.maxHp).toBe(10000);
      }
      expect(units[0].attributes).toBeDefined();
      for (const unit of units.filter((u) => u.ownerId === 'unit-0'))
        expect(unit.attributes).toBeDefined();
    }
    expect(() => combatV6ReplayView(replay, id, 'outsider')).toThrow(
      'REPLAY_FORBIDDEN',
    );
    expect(() => combatV6ReplayView(replay, 'outsider', 'user')).toThrow(
      'REPLAY_FORBIDDEN',
    );
  });
  it('uses frozen descriptions and display facts independently of current engine versions', () => {
    const { replay } = record('16-area');
    const before = combatV6ReplayView(replay, id, 'user');
    replay.combatVersions.rulesetVersion = 'old-rules';
    replay.skills.forEach((s) => {
      s.name = 'changed';
    });
    const after = combatV6ReplayView(replay, id, 'user');
    expect(after.timeline).toEqual(before.timeline);
    expect(after.display).toEqual(before.display);
  });
  it('rejects legacy, incomplete or unknown formats and corrupt deltas', () => {
    const { replay } = record('1v3');
    const { timeline, display, ...legacy } = replay;
    expect(() =>
      parseCombatV6Replay({
        ...legacy,
        replayVersion: 'combat_v6_replay_v1',
      }),
    ).toThrow();
    expect(() => parseCombatV6Replay(legacy)).toThrow();
    expect(() =>
      parseCombatV6Replay({ ...replay, replayVersion: 'future' }),
    ).toThrow();
    replay.timeline!.frames[0].updates.push({ id: 'missing', set: { hp: 0 } });
    expect(() => combatV6ReplayView(replay, id, 'user')).toThrow();
    expect(timeline).toBeDefined();
    expect(display).toBeDefined();
  });
});
