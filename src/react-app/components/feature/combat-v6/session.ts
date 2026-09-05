import { applyUnitDelta, contiguousEvents } from '@shared/combat-v6/playback';
import type {
  CombatV6DeltaFrameV1,
  CombatV6TrainingSessionViewV1,
} from '@shared/contracts/combatV6';
import { appendBattleEntries, type BattleLog } from './presentation';

export type CombatV6Session = Omit<
  CombatV6TrainingSessionViewV1,
  'encounterId' | 'tier'
> & { settlement?: 'pending' | 'settled' | 'not-started' };
export type CombatV6Unit = CombatV6Session['units'][number];
export type SequencedEvent = CombatV6Session['events'][number];
export type SessionState<T extends CombatV6Session> = {
  session: T | null;
  shown: { units: CombatV6Unit[]; round: number; visibleSeq: number };
  queue: CombatV6DeltaFrameV1[];
  log: BattleLog;
  recoveryNeeded: boolean;
};
export function emptySession<T extends CombatV6Session>(): SessionState<T> {
  return {
    session: null,
    shown: { units: [], round: 0, visibleSeq: -1 },
    queue: [],
    log: { entries: [], round: 0, open: false, seq: -1 },
    recoveryNeeded: false,
  };
}
export type SessionAction<T> =
  { type: 'receive'; session: T | null; full?: boolean } | { type: 'advance' };
export function reduceSession<T extends CombatV6Session>(
  state: SessionState<T>,
  action: SessionAction<T>,
): SessionState<T> {
  if (action.type === 'advance') {
    const [frame, ...queue] = state.queue;
    if (!frame || state.recoveryNeeded) return state;
    try {
      return {
        ...state,
        queue,
        shown: {
          units: applyUnitDelta(state.shown.units, frame),
          round: frame.round,
          visibleSeq: frame.afterEventSeq,
        },
      };
    } catch {
      return { ...state, queue: [], recoveryNeeded: true };
    }
  }
  const next = action.session;
  if (!next) return emptySession<T>();
  const sameSession = state.session?.sessionId === next.sessionId;
  if (sameSession && state.session && next.revision < state.session.revision)
    return state;
  const { playback, ...withoutPlayback } = next;
  const snapshot = withoutPlayback as T;
  const reset = action.full || !sameSession;
  if (reset) {
    if (!contiguousEvents(next.events, -1, next.latestEventSeq))
      return { ...state, session: snapshot, queue: [], recoveryNeeded: true };
    return {
      session: snapshot,
      shown: {
        units: next.units,
        round: next.round,
        visibleSeq: next.latestEventSeq,
      },
      queue: [],
      log: appendBattleEntries(emptySession<T>().log, next.events, next),
      recoveryNeeded: false,
    };
  }
  if (state.recoveryNeeded) return state;
  const old = state.session!;
  const appended = next.events.filter((e) => e.seq > old.latestEventSeq);
  if (!contiguousEvents(appended, old.latestEventSeq, next.latestEventSeq))
    return { ...state, queue: [], recoveryNeeded: true };
  const session = {
    ...snapshot,
    events: appended.length ? [...old.events, ...appended] : old.events,
  };
  const log = appended.length
    ? appendBattleEntries(state.log, appended, {
        ...session,
        units: [
          ...new Map(
            [...old.units, ...session.units].map((u) => [u.id, u]),
          ).values(),
        ],
      })
    : state.log;
  if (next.revision === old.revision) {
    return next.latestEventSeq === old.latestEventSeq
      ? { ...state, session, log }
      : { ...state, queue: [], recoveryNeeded: true };
  }
  if (!playback) {
    if (
      appended.length &&
      (state.queue.length ||
        appended.some((e) => e.event.type !== 'commandAccepted'))
    )
      return { ...state, queue: [], recoveryNeeded: true };
    return {
      ...state,
      session,
      log,
      shown: appended.length
        ? { ...state.shown, visibleSeq: next.latestEventSeq }
        : state.shown,
    };
  }
  const from = state.queue.length
    ? state.queue[state.queue.length - 1].afterEventSeq
    : state.shown.visibleSeq;
  let cursor = from;
  if (playback.format !== 'delta-v1' || playback.fromEventSeq !== from)
    return { ...state, queue: [], recoveryNeeded: true };
  for (const frame of playback.frames) {
    if (
      frame.afterEventSeq <= cursor ||
      frame.afterEventSeq > next.latestEventSeq
    )
      return { ...state, queue: [], recoveryNeeded: true };
    cursor = frame.afterEventSeq;
  }
  if (cursor !== next.latestEventSeq)
    return { ...state, queue: [], recoveryNeeded: true };
  return {
    ...state,
    session,
    log,
    queue: [...state.queue, ...playback.frames],
  };
}
