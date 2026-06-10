import type { PlayerStateEvent } from '@shared/contracts/player';

type Listener = (events: PlayerStateEvent[]) => void;

const listeners = new Map<string, Set<Listener>>();

export function subscribePlayerStateEvents(
  cultivatorId: string,
  listener: Listener,
): () => void {
  const set = listeners.get(cultivatorId) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(cultivatorId, set);

  return () => {
    set.delete(listener);
    if (set.size === 0) {
      listeners.delete(cultivatorId);
    }
  };
}

export function publishPlayerStateEvents(
  cultivatorId: string,
  events: PlayerStateEvent[],
) {
  if (events.length === 0) {
    return;
  }

  const set = listeners.get(cultivatorId);
  if (!set) {
    return;
  }

  for (const listener of set) {
    listener(events);
  }
}
