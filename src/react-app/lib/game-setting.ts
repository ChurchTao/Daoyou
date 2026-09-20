import { useSyncExternalStore } from 'react';

/** Browser-wide presentation preferences. Never store credentials or game state here. */
export interface GameSettings {
  mapMode: 'atlas' | 'text';
}

export const GAME_SETTING_STORAGE_KEY = 'game-setting';
const defaults: Readonly<GameSettings> = { mapMode: 'atlas' };
let snapshot = defaults;
let initialized = false;
let memoryOnly = false;
const listeners = new Set<() => void>();

function readSettings(): GameSettings {
  try {
    const stored = JSON.parse(
      localStorage.getItem(GAME_SETTING_STORAGE_KEY) ?? 'null',
    );
    if (stored?.version === 1 && ['atlas', 'text'].includes(stored.mapMode)) {
      return { mapMode: stored.mapMode };
    }
  } catch {
    // Unavailable storage or malformed preferences fall back to defaults.
  }
  return defaults;
}

function publish(next: GameSettings) {
  if (snapshot.mapMode === next.mapMode) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function getSnapshot() {
  if (!initialized) {
    snapshot = readSettings();
    initialized = true;
  }
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === GAME_SETTING_STORAGE_KEY || event.key === null)
      publish(readSettings());
  };
  window.addEventListener('storage', onStorage);
  // Catch changes between render and subscription (including remounts).
  if (!memoryOnly) publish(readSettings());
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function updateGameSettings(patch: Partial<GameSettings>) {
  const next = { ...getSnapshot(), ...patch };
  try {
    localStorage.setItem(
      GAME_SETTING_STORAGE_KEY,
      JSON.stringify({ version: 1, ...next }),
    );
    memoryOnly = false;
  } catch {
    memoryOnly = true;
    // Switching remains usable in this session when persistence is blocked.
  }
  publish(next);
}

export function useGameSettings() {
  return useSyncExternalStore(subscribe, getSnapshot, () => defaults);
}
