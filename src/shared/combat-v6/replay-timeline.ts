import type { CombatV6ReplayTimeline } from '../contracts/combatV6Replay';
import type { BattleState, StatusDef } from '../engine/combat-v6/core';
import { applyUnitDelta } from './playback';
import { combatV6Playback, combatV6Units } from './presentation';

/** Incremental HTTP playback after server-driven rounds; recovery still loads the full baseline. */
export function liveReplayDelta(
  timeline: CombatV6ReplayTimeline,
  after: number,
) {
  if (after < timeline.fromEventSeq) return undefined;
  const frames = timeline.frames.filter((frame) => frame.afterEventSeq > after);
  return frames.length
    ? { format: 'delta-v1' as const, fromEventSeq: after, frames }
    : undefined;
}

export function startReplayTimeline(
  state: BattleState,
  statuses: StatusDef[],
  seq: number,
): CombatV6ReplayTimeline {
  return {
    format: 'delta-v1',
    initialUnits: combatV6Units(state, statuses),
    initialRound: state.round,
    fromEventSeq: seq,
    frames: [],
  };
}

/** Collect only the current round, then append it to the durable timeline in the same CAS. */
export function replayRound(
  timeline: CombatV6ReplayTimeline,
  state: BattleState,
  statuses: StatusDef[],
  seq: number,
) {
  const collector = combatV6Playback(seq, statuses, state);
  return {
    capture: collector.capture,
    finish(final: BattleState, finalSeq: number) {
      collector.capture(final, finalSeq);
      timeline.frames.push(...collector.playback.frames);
    },
  };
}

/** Bounded checkpoints, built lazily. No array of full per-action snapshots. */
export function replaySeeker(timeline: CombatV6ReplayTimeline) {
  type Position = {
    index: number;
    units: CombatV6ReplayTimeline['initialUnits'];
    round: number;
    visibleSeq: number;
  };
  const initial: Position = {
    index: 0,
    units: timeline.initialUnits,
    round: timeline.initialRound,
    visibleSeq: timeline.fromEventSeq,
  };
  const checkpoints = new Map<number, Position>([[0, initial]]);
  let current = initial;
  return (requested: number): Position => {
    const index = Math.max(
      0,
      Math.min(timeline.frames.length, Math.trunc(requested)),
    );
    let position = current.index <= index ? current : initial;
    for (const point of checkpoints.values())
      if (point.index <= index && point.index > position.index)
        position = point;
    while (position.index < index) {
      const frame = timeline.frames[position.index];
      if (frame.afterEventSeq < position.visibleSeq)
        throw new Error('回放事件顺序无效');
      position = {
        index: position.index + 1,
        units: applyUnitDelta(position.units, frame),
        round: frame.round,
        visibleSeq: frame.afterEventSeq,
      };
      if (position.index % 32 === 0) {
        checkpoints.set(position.index, position);
        if (checkpoints.size > 16)
          checkpoints.delete([...checkpoints.keys()].find((key) => key !== 0)!);
      }
    }
    current = position;
    return position;
  };
}
