import { useSyncExternalStore } from 'react';

/** Browser-local preferences. Never store credentials or battle progress here. */
export interface GameSettings {
  mapMode: 'atlas' | 'text';
  imageOpacity: number;
  /** Remember the in-battle auto toggle for later battles in this browser. */
  keepCombatAuto: boolean;
  /** Last in-battle auto choice. Honored only while `keepCombatAuto` is on. */
  combatAutoHeld: boolean;
}

export const GAME_SETTING_STORAGE_KEY = 'game-setting';
const defaults: Readonly<GameSettings> = {
  mapMode: 'atlas',
  imageOpacity: 1,
  keepCombatAuto: false,
  combatAutoHeld: false,
};
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
      const keepCombatAuto = stored.keepCombatAuto === true;
      return {
        mapMode: ['atlas', 'text'].includes(stored.mapMode)
          ? stored.mapMode
          : defaults.mapMode,
        imageOpacity: normalizeImageOpacity(stored.imageOpacity),
        keepCombatAuto,
        combatAutoHeld: keepCombatAuto && stored.combatAutoHeld === true,
      };
    }
  } catch {
    // Unavailable storage or malformed preferences fall back to defaults.
  }
  return defaults;
}

function sameSettings(left: GameSettings, right: GameSettings) {
  return (
    left.mapMode === right.mapMode &&
    left.imageOpacity === right.imageOpacity &&
    left.keepCombatAuto === right.keepCombatAuto &&
    left.combatAutoHeld === right.combatAutoHeld
  );
}

function publish(next: GameSettings) {
  if (sameSettings(snapshot, next)) return;
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
  next.keepCombatAuto = next.keepCombatAuto === true;
  // The held choice is meaningless until the player asks to keep it.
  next.combatAutoHeld = next.keepCombatAuto && next.combatAutoHeld === true;
  if (sameSettings(snapshot, next)) return;
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
