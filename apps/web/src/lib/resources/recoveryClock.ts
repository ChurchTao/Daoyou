import { useCallback, useSyncExternalStore } from 'react';

const RECOVERY_CLOCK_INTERVAL_MS = 60_000;
const MIN_TIMER_DELAY_MS = 16;

type Listener = () => void;

const listeners = new Map<Listener, number | null>();
let serverAnchorMs = Date.now();
let monotonicAnchorMs = readMonotonicNowMs();
let snapshotNowMs = serverAnchorMs;
let timer: number | undefined;

function readMonotonicNowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function readEstimatedServerNowMs(): number {
  return serverAnchorMs + (readMonotonicNowMs() - monotonicAnchorMs);
}

function emitNow(): void {
  snapshotNowMs = readEstimatedServerNowMs();
  for (const listener of listeners.keys()) listener();
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    emitNow();
    scheduleNextTick();
    return;
  }
  stopTimer();
}

function getNextDelayMs(nowMs: number): number {
  let delayMs = Number.POSITIVE_INFINITY;
  let needsMinuteHeartbeat = false;

  for (const deadlineMs of listeners.values()) {
    if (deadlineMs === null || !Number.isFinite(deadlineMs)) {
      needsMinuteHeartbeat = true;
      continue;
    }
    if (deadlineMs > nowMs + MIN_TIMER_DELAY_MS) {
      delayMs = Math.min(delayMs, deadlineMs - nowMs);
    }
  }

  if (needsMinuteHeartbeat || !Number.isFinite(delayMs)) {
    delayMs = Math.min(delayMs, RECOVERY_CLOCK_INTERVAL_MS);
  }
  return Math.max(MIN_TIMER_DELAY_MS, Math.ceil(delayMs));
}

function scheduleNextTick(): void {
  if (
    typeof window === 'undefined' ||
    listeners.size === 0 ||
    document.visibilityState !== 'visible'
  ) {
    return;
  }
  stopTimer();
  snapshotNowMs = readEstimatedServerNowMs();
  timer = window.setTimeout(() => {
    timer = undefined;
    emitNow();
    scheduleNextTick();
  }, getNextDelayMs(snapshotNowMs));
}

function stopTimer(): void {
  if (typeof window === 'undefined' || timer === undefined) return;
  window.clearTimeout(timer);
  timer = undefined;
}

function startClock(): void {
  if (typeof window === 'undefined') return;
  document.addEventListener('visibilitychange', handleVisibilityChange);
  scheduleNextTick();
}

function stopClock(): void {
  if (typeof window === 'undefined') return;
  stopTimer();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
}

function subscribe(
  listener: Listener,
  nextWakeAtMs: number | null,
): () => void {
  listeners.set(listener, nextWakeAtMs);
  if (listeners.size === 1) startClock();
  else scheduleNextTick();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopClock();
      return;
    }
    scheduleNextTick();
  };
}

function subscribeDisabled(): () => void {
  return () => undefined;
}

function getSnapshot(): number {
  return snapshotNowMs;
}

export function observePlayerResourceServerTime(serverTime: string): void {
  const parsed = Date.parse(serverTime);
  if (!Number.isFinite(parsed)) return;
  serverAnchorMs = parsed;
  monotonicAnchorMs = readMonotonicNowMs();
  snapshotNowMs = parsed;
  if (listeners.size > 0) {
    for (const listener of listeners.keys()) listener();
    scheduleNextTick();
  }
}

export function getEstimatedServerNowMs(): number {
  return readEstimatedServerNowMs();
}

export function useRecoveryClock(
  enabled: boolean,
  nextWakeAtMs: number | null = null,
): number {
  const subscribeToClock = useCallback(
    (listener: Listener) =>
      enabled ? subscribe(listener, nextWakeAtMs) : subscribeDisabled(),
    [enabled, nextWakeAtMs],
  );
  const snapshot = useSyncExternalStore(
    subscribeToClock,
    getSnapshot,
    getSnapshot,
  );
  return enabled ? snapshot : getEstimatedServerNowMs();
}
