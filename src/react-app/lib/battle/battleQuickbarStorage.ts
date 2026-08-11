const STORAGE_KEY = 'daoyou:battle-quickbar:v1';
const MAX_SLOTS = 4;

interface StoredQuickbarStateV1 {
  version: 1;
  users: Record<string, Record<string, string[]>>;
}

function emptyState(): StoredQuickbarStateV1 {
  return { version: 1, users: {} };
}

function readState(): StoredQuickbarStateV1 {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<StoredQuickbarStateV1>;
    if (parsed.version !== 1 || !parsed.users || typeof parsed.users !== 'object') {
      return emptyState();
    }
    return { version: 1, users: parsed.users as StoredQuickbarStateV1['users'] };
  } catch {
    return emptyState();
  }
}

function writeState(state: StoredQuickbarStateV1): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing or a full storage quota must not block battle input.
  }
}

function scope(userId: string, unitId: string): string {
  void userId;
  return unitId;
}

export function loadBattleQuickbar(userId: string, unitId: string): string[] {
  const slots = readState().users[userId]?.[scope(userId, unitId)] ?? [];
  return Array.from(new Set(slots)).slice(0, MAX_SLOTS);
}

export function saveBattleQuickbar(
  userId: string,
  unitId: string,
  abilityIds: readonly string[],
): string[] {
  const state = readState();
  const next = Array.from(new Set(abilityIds)).slice(0, MAX_SLOTS);
  const user = state.users[userId] ?? {};
  user[scope(userId, unitId)] = next;
  state.users[userId] = user;
  writeState(state);
  return next;
}

export function toggleBattleQuickbarAbility(
  userId: string,
  unitId: string,
  abilityId: string,
): string[] {
  const current = loadBattleQuickbar(userId, unitId);
  return saveBattleQuickbar(
    userId,
    unitId,
    current.includes(abilityId)
      ? current.filter((id) => id !== abilityId)
      : [...current, abilityId],
  );
}

export const BATTLE_QUICKBAR_MAX_SLOTS = MAX_SLOTS;
