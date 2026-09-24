import { useSyncExternalStore } from 'react';

/** Browser-wide presentation preferences. Never store credentials or game state here. */
export interface GameSettings {
  mapMode: 'atlas' | 'text';
  imageOpacity: number;
}

export const GAME_SETTING_STORAGE_KEY = 'game-setting';
const defaults: Readonly<GameSettings> = { mapMode: 'atlas', imageOpacity: 1 };
let snapshot = defaults;
let initialized = false;
let memoryOnly = false;
const listeners = new Set<() => void>();

function normalizeImageOpacity(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : defaults.imageOpacity;
}

function readSettings(): GameSettings {
  try {
    const stored = JSON.parse(
      localStorage.getItem(GAME_SETTING_STORAGE_KEY) ?? 'null',
    );
    if (stored?.version === 1) {
      return {
        mapMode: ['atlas', 'text'].includes(stored.mapMode)
          ? stored.mapMode
          : defaults.mapMode,
        imageOpacity: normalizeImageOpacity(stored.imageOpacity),
      };
    }
  } catch {
    // Unavailable storage or malformed preferences fall back to defaults.
  }
  return defaults;
}

function publish(next: GameSettings) {
  if (
    snapshot.mapMode === next.mapMode &&
    snapshot.imageOpacity === next.imageOpacity
  )
    return;
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

function onStorage(event: StorageEvent) {
  if (
    event.storageArea === window.localStorage &&
    (event.key === GAME_SETTING_STORAGE_KEY || event.key === null)
  )
    publish(readSettings());
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  // Catch changes between render and subscription (including remounts).
  if (!memoryOnly) publish(readSettings());
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

export function updateGameSettings(patch: Partial<GameSettings>) {
  const next = { ...getSnapshot(), ...patch };
  next.imageOpacity = normalizeImageOpacity(next.imageOpacity);
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
