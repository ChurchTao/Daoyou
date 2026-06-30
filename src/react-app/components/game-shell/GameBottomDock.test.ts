import { describe, expect, it } from 'vitest';
import {
  getCoreDockItemBadge,
  shouldShowGameDockBadge,
} from './gameBottomDockBadge';

describe('GameBottomDock badge helpers', () => {
  it('shows badges for positive counts and boolean reminders', () => {
    expect(shouldShowGameDockBadge(1)).toBe(true);
    expect(shouldShowGameDockBadge(true)).toBe(true);
    expect(shouldShowGameDockBadge(0)).toBe(false);
    expect(shouldShowGameDockBadge(false)).toBe(false);
    expect(shouldShowGameDockBadge(undefined)).toBe(false);
  });

  it('keeps mail count and cultivator attribute reminders independent', () => {
    expect(
      getCoreDockItemBadge('mail', {
        unreadMailCount: 3,
        hasUnallocatedAttributePoints: false,
      }),
    ).toBe(3);
    expect(
      getCoreDockItemBadge('cultivator', {
        unreadMailCount: 0,
        hasUnallocatedAttributePoints: true,
      }),
    ).toBe(true);
    expect(
      getCoreDockItemBadge('inventory', {
        unreadMailCount: 3,
        hasUnallocatedAttributePoints: true,
      }),
    ).toBeUndefined();
  });
});
