import {
  encodeNatsSubjectToken,
  publishNatsCoreMessage,
  subscribeNatsCoreSubject,
  waitForNatsCoreSubjectReady,
} from './natsCorePubSub';
import {
  createPubSubEnvelope,
  parsePubSubEnvelope,
} from './pubSubEnvelope';
const SUBJECT_PREFIX = 'daoyou.realtime.battle.match';
export type OnlineBattleBroadcastEvent = {
  readonly kind: 'state_changed';
  readonly matchId: string;
  readonly revision: number;
  readonly eventSeq: number;
};

type Listener = (event: OnlineBattleBroadcastEvent) => void;
const listeners = new Map<string, Set<Listener>>();
const subscriptions = new Map<string, () => void>();

function subjectForMatch(matchId: string): string {
  return `${SUBJECT_PREFIX}.${encodeNatsSubjectToken(matchId)}`;
}

export function subscribeOnlineBattleChanges(
  matchId: string,
  listener: Listener,
): { readonly ready: Promise<void>; readonly unsubscribe: () => void } {
  const set = listeners.get(matchId) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(matchId, set);
  if (!subscriptions.has(matchId)) {
    subscriptions.set(
      matchId,
      subscribeNatsCoreSubject(subjectForMatch(matchId), (raw) => {
        const event = parsePubSubEnvelope(raw, isBroadcastEvent);
        if (!event || event.matchId !== matchId) return;
        notifyLocal(event);
      }),
    );
  }
  return {
    ready: waitForNatsCoreSubjectReady(subjectForMatch(matchId)),
    unsubscribe: () => {
      set.delete(listener);
      if (set.size > 0) return;
      listeners.delete(matchId);
      subscriptions.get(matchId)?.();
      subscriptions.delete(matchId);
    },
  };
}

export function publishOnlineBattleEvent(event: OnlineBattleBroadcastEvent): void {
  notifyLocal(event);
  void publishNatsCoreMessage(
    subjectForMatch(event.matchId),
    encodeOnlineBattleBroadcastEvent(event),
  );
}

export function encodeOnlineBattleBroadcastEvent(
  event: OnlineBattleBroadcastEvent,
): string {
  return JSON.stringify(createPubSubEnvelope(event));
}

export async function closeOnlineBattleBroadcaster(): Promise<void> {
  for (const unsubscribe of subscriptions.values()) unsubscribe();
  subscriptions.clear();
  listeners.clear();
}

function notifyLocal(event: OnlineBattleBroadcastEvent): void {
  for (const listener of listeners.get(event.matchId) ?? []) {
    try {
      listener(event);
    } catch (error) {
      console.warn('[online-battle] local listener failed', {
        matchId: event.matchId,
        error,
      });
    }
  }
}

function isBroadcastEvent(value: unknown): value is OnlineBattleBroadcastEvent {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'kind' in value &&
      value.kind === 'state_changed' &&
      'matchId' in value &&
      'revision' in value &&
      typeof value.matchId === 'string' &&
      Number.isSafeInteger(value.revision) &&
      'eventSeq' in value &&
      Number.isSafeInteger(value.eventSeq),
  );
}
