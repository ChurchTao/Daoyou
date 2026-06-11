import { describe, expect, it } from 'vitest';
import { getExpandedDockGroups } from './gameNavigation';

describe('game navigation dock groups', () => {
  it('keeps cave-local and core dock entries out of the expanded dock menu', () => {
    const expandedIds = getExpandedDockGroups().flatMap((group) =>
      group.actions.map((action) => action.id),
    );

    expect(expandedIds).not.toContain('retreat');
    expect(expandedIds).not.toContain('inn');
    expect(expandedIds).not.toContain('enlightenment');
    expect(expandedIds).not.toContain('training-room');
    expect(expandedIds).not.toContain('craft');
    expect(expandedIds).not.toContain('manual-draw');
    expect(expandedIds).not.toContain('inventory');
    expect(expandedIds).not.toContain('mail');
  });
});
