import { describe, expect, it, vi } from 'vitest';
import {
  ACCOUNT_DELETION_CONFIRMATION,
  ACCOUNT_DELETION_LOCAL_STORAGE_KEYS,
  ACCOUNT_DELETION_SESSION_STORAGE_KEYS,
  clearAccountDeletionBrowserData,
  isAccountDeletionConfirmation,
} from './accountDeletion';

describe('account deletion browser helpers', () => {
  it('requires the exact confirmation phrase', () => {
    expect(isAccountDeletionConfirmation(ACCOUNT_DELETION_CONFIRMATION)).toBe(
      true,
    );
    expect(isAccountDeletionConfirmation(' 注销账号')).toBe(false);
    expect(isAccountDeletionConfirmation('注销')).toBe(false);
  });

  it('clears only the known Daoyou browser keys', () => {
    const localRemoveItem = vi.fn();
    const sessionRemoveItem = vi.fn();

    clearAccountDeletionBrowserData(
      { removeItem: localRemoveItem },
      { removeItem: sessionRemoveItem },
    );

    expect(localRemoveItem.mock.calls.map(([key]) => key)).toEqual(
      ACCOUNT_DELETION_LOCAL_STORAGE_KEYS,
    );
    expect(sessionRemoveItem.mock.calls.map(([key]) => key)).toEqual(
      ACCOUNT_DELETION_SESSION_STORAGE_KEYS,
    );
  });

  it('continues clearing after a storage removal fails', () => {
    const localRemoveItem = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('storage denied');
      })
      .mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    clearAccountDeletionBrowserData(
      { removeItem: localRemoveItem },
      { removeItem: vi.fn() },
    );

    expect(localRemoveItem).toHaveBeenCalledTimes(
      ACCOUNT_DELETION_LOCAL_STORAGE_KEYS.length,
    );
    expect(warn).toHaveBeenCalledOnce();
  });
});
