import { describe, expect, it } from 'vitest';
import {
  getCoreDockItems,
  getExpandedDockGroups,
  getGameSceneMeta,
} from './gameNavigation';

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
    expect(expandedIds).not.toContain('body-cultivation');
  });

  it('registers body cultivation scene metadata without adding a dock entry', () => {
    const coreIds = getCoreDockItems().map((item) => item.id);
    const expandedIds = getExpandedDockGroups().flatMap((group) =>
      group.actions.map((action) => action.id),
    );

    expect(getGameSceneMeta('body-cultivation')).toMatchObject({
      id: 'body-cultivation',
      label: '肉身炼体',
      group: 'cultivation',
    });
    expect(coreIds).not.toContain('body-cultivation');
    expect(expandedIds).not.toContain('body-cultivation');
  });
});
