import {
  COMBAT_V6_REPLAY_VERSION,
  parseCombatV6Replay,
  type CombatV6ReplayV1,
} from '@shared/contracts/combatV6Runtime';
import { arenaEvents, arenaUnits } from './arena';
import { combatV6Display } from './presentation';

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
    > & { finalState?: CombatV6ReplayV1['finalState'] };
  },
): CombatV6ReplayV1 {
  const { trace, ...metadata } = input;
  if (!trace.finalState) throw new Error('Cannot archive without final state');
  const winner = trace.finalState.result?.winner;
  return parseCombatV6Replay({
    ...metadata,
    replayVersion: COMBAT_V6_REPLAY_VERSION,
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
  replay: CombatV6ReplayV1,
  cultivatorId: string,
  userId: string,
) {
  const viewer = replay.participants.find(
    (p) => p.cultivatorId === cultivatorId && p.userId === userId,
  );
  if (!viewer) throw new Error('REPLAY_FORBIDDEN');
  const events = arenaEvents(replay.events);
  const ownSkills = new Set(
    replay.finalState.units.find((u) => u.id === viewer.unitId)!.skills,
  );
  const display = combatV6Display(
    replay.skills.filter((s) => ownSkills.has(s.id)),
    replay.statusDefs,
  );
  for (const { event } of events) {
    if (event.type === 'actionStart' && event.command.type === 'skill')
      ownSkills.add(event.command.skillId);
  }
  return {
    battleId: replay.battleId,
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
    units: arenaUnits(replay.finalState, replay, viewer.unitId),
    events,
    display: {
      ...display,
      skills: Object.fromEntries(
        replay.skills
          .filter((s) => ownSkills.has(s.id))
          .map((s) => [s.id, s.name]),
      ),
    },
  };
}
