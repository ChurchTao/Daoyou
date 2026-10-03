export const ACCOUNT_DELETION_CONFIRMATION = '注销账号';

export const ACCOUNT_DELETION_LOCAL_STORAGE_KEYS = [
  'daoyou_llm_config',
  'training-room-config-v1',
  'daoyou:battle-status-dock-collapsed',
] as const;

export const ACCOUNT_DELETION_SESSION_STORAGE_KEYS = [
  'reincarnateContext',
] as const;

type StorageRemover = Pick<Storage, 'removeItem'>;

function removeKeys(storage: StorageRemover, keys: readonly string[]) {
  for (const key of keys) {
    try {
      storage.removeItem(key);
    } catch (error) {
      console.warn('[account-deletion] failed to clear browser storage', {
        key,
        error,
      });
    }
  }
}

export function isAccountDeletionConfirmation(value: string): boolean {
  return value === ACCOUNT_DELETION_CONFIRMATION;
}

export function clearAccountDeletionBrowserData(
  localStorage: StorageRemover = window.localStorage,
  sessionStorage: StorageRemover = window.sessionStorage,
): void {
  removeKeys(localStorage, ACCOUNT_DELETION_LOCAL_STORAGE_KEYS);
  removeKeys(sessionStorage, ACCOUNT_DELETION_SESSION_STORAGE_KEYS);
}
