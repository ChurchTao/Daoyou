import {
  COMBAT_V6_REPLAY_VERSION,
  parseCombatV6Replay,
  type CombatV6ReplayV1,
} from '@shared/contracts/combatV6Runtime';
import type { CombatV6ReplayTimeline } from '../contracts/combatV6Replay';
import { arenaEvents, projectReplayUnits } from './arena';
import { applyUnitDelta, diffUnits } from './playback';
import {
  combatV6Display,
  combatV6Units,
  visibleUnitNames,
} from './presentation';

/** All hosts emit the same archive, without delivery state or host snapshots. */
export function createCombatV6Replay(
  input: Pick<
    CombatV6ReplayV1,
    | 'battleId'
    | 'participants'
    | 'metadata'
    | 'startedAt'
    | 'finishedAt'
    | 'reason'
  > & {
    trace: Pick<
      CombatV6ReplayV1,
      'seed' | 'initialUnits' | 'skills' | 'statusDefs' | 'rounds' | 'events'
    > & {
      finalState?: CombatV6ReplayV1['finalState'];
      timeline: CombatV6ReplayTimeline;
    };
  },
): CombatV6ReplayV1 {
  const { trace, ...metadata } = input;
  if (!trace.finalState) throw new Error('Cannot archive without final state');
  const winner = trace.finalState.result?.winner;
  return parseCombatV6Replay({
    ...metadata,
    replayVersion: COMBAT_V6_REPLAY_VERSION,
    timeline: {
      ...trace.timeline,
      finalUnits: combatV6Units(trace.finalState, trace.statusDefs),
    },
    display: combatV6Display(trace.skills, trace.statusDefs),
    seed: trace.seed,
    combatVersions: trace.finalState.versions,
    initialUnits: trace.initialUnits,
    skills: trace.skills,
    statusDefs: trace.statusDefs,
    rounds: trace.rounds,
    events: trace.events,
    finalState: trace.finalState,
    outcome:
      input.reason !== 'battle-ended' || winner === undefined
        ? 'aborted'
        : winner === 'draw'
          ? 'draw'
          : `side-${winner}`,
  });
}

/** Participant-facing projection; authoritative archive contents stay on the server. */
export function combatV6ReplayView(
  archive: CombatV6ReplayV1,
  cultivatorId: string,
  userId: string,
) {
  const replay = parseCombatV6Replay(archive);
  const viewer = replay.participants.find(
    (p) => p.cultivatorId === cultivatorId && p.userId === userId,
  );
  if (!viewer) throw new Error('REPLAY_FORBIDDEN');
  const events = arenaEvents(replay.events);
  const ownSkills = new Set(
    replay.finalState.units
      .filter((u) => u.id === viewer.unitId || u.ownerId === viewer.unitId)
      .flatMap((u) => u.skills),
  );
  const frozenDisplay = replay.display;
  const display = {
    ...frozenDisplay,
    unitNames: visibleUnitNames(
      replay.finalState,
      replay.events,
      viewer.unitId,
    ),
    skillDetails: Object.fromEntries(
      Object.entries(frozenDisplay.skillDetails ?? {}).filter(([id]) =>
        ownSkills.has(id),
      ),
    ),
  };
  for (const { event } of events) {
    if (event.type === 'actionStart' && event.command.type === 'skill')
      ownSkills.add(event.command.skillId);
  }
  return {
    battleId: replay.battleId,
    controlledUnitId: viewer.unitId,
    timeline: projectTimeline(replay, viewer.unitId, viewer.side),
    combatVersions: replay.combatVersions,
    startedAt: replay.startedAt,
    finishedAt: replay.finishedAt,
    round: replay.finalState.round,
    reason: replay.reason,
    outcome:
      replay.outcome === 'draw' || replay.outcome === 'aborted'
        ? replay.outcome
        : replay.outcome === `side-${viewer.side}`
          ? 'victory'
          : 'defeat',
    units: projectReplayUnits(
      replay.timeline.finalUnits!,
      viewer.unitId,
      viewer.side,
    ),
    events,
    display: {
      ...display,
      skills: Object.fromEntries(
        replay.skills
          .filter((s) => ownSkills.has(s.id))
          .map((s) => [s.id, frozenDisplay.skills[s.id] ?? s.name]),
      ),
    },
  };
}

/** Reconstruct server-side display facts, then diff the authorized view. Never expose raw deltas. */
function projectTimeline(
  replay: CombatV6ReplayV1,
  viewerId: string,
  side: 0 | 1,
): CombatV6ReplayTimeline {
  const tape = replay.timeline;
  const cursors: number[] = [];
  let cursor = -1;
  for (const event of replay.events) {
    cursor += arenaEvents([event]).length;
    cursors.push(cursor);
  }
  const publicSeq = (seq: number) => {
    if (seq === -1) return -1;
    if (cursors[seq] === undefined) throw new Error('REPLAY_CURSOR_INVALID');
    return cursors[seq];
  };
  let raw = tape.initialUnits;
  let previous = projectReplayUnits(raw, viewerId, side);
  const final = projectReplayUnits(tape.finalUnits!, viewerId, side);
  const timeline: CombatV6ReplayTimeline = {
    ...tape,
    initialUnits: previous,
    finalUnits: final,
    fromEventSeq: publicSeq(tape.fromEventSeq),
    frames: [],
  };
  for (const frame of tape.frames) {
    raw = applyUnitDelta(raw, frame);
    const next = projectReplayUnits(raw, viewerId, side);
    timeline.frames.push(
      diffUnits(previous, next, publicSeq(frame.afterEventSeq), frame.round),
    );
    previous = next;
  }
  const correction = diffUnits(
    raw,
    tape.finalUnits!,
    replay.events.length ? cursors[cursors.length - 1] : -1,
    replay.finalState.round,
  );
  if (
    correction.updates.length ||
    correction.added?.length ||
    correction.removed?.length ||
    correction.order
  )
    throw new Error('REPLAY_FINAL_STATE_MISMATCH');
  return timeline;
}

export type CombatV6ReplayView = ReturnType<typeof combatV6ReplayView>;
