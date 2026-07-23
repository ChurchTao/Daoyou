import { describe, expect, it } from 'vitest';
import { resolveMapCloseNavigation } from './mapCloseNavigation';

describe('map close navigation', () => {
  it('closes the sect-selection map without returning to a visited sect', () => {
    expect(resolveMapCloseNavigation('?intent=sect&nodeId=SECT_YOUDU')).toEqual({
      type: 'path',
      href: '/game',
      replace: true,
    });
  });

  it.each(['', '?intent=dungeon', '?intent=market'])(
    'preserves history-based closing for ordinary map flow %s',
    (search) => {
      expect(resolveMapCloseNavigation(search)).toEqual({
        type: 'history-or-path',
        fallbackHref: '/game',
      });
    },
  );
});
