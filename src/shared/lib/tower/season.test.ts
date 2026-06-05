import { describe, expect, it } from 'vitest';
import {
  getNextTowerSeasonMeta,
  getTowerSeasonMeta,
  isTowerSeasonKeyCurrent,
} from './season';

describe('tower season helpers', () => {
  it('switches season at Monday 00:00 Asia/Shanghai', () => {
    const beforeReset = getTowerSeasonMeta(new Date('2026-05-31T15:59:59.000Z'));
    const afterReset = getTowerSeasonMeta(new Date('2026-05-31T16:00:00.000Z'));

    expect(beforeReset.seasonKey).toBe('2026-W22@Asia/Shanghai');
    expect(afterReset.seasonKey).toBe('2026-W23@Asia/Shanghai');
    expect(afterReset.seasonStartedAt).toBe('2026-05-31T16:00:00.000Z');
    expect(afterReset.nextResetAt).toBe('2026-06-07T16:00:00.000Z');
  });

  it('recognizes stale season keys', () => {
    expect(
      isTowerSeasonKeyCurrent(
        '2026-W22@Asia/Shanghai',
        new Date('2026-05-31T15:59:59.000Z'),
      ),
    ).toBe(true);
    expect(
      isTowerSeasonKeyCurrent(
        '2026-W22@Asia/Shanghai',
        new Date('2026-05-31T16:00:00.000Z'),
      ),
    ).toBe(false);
  });

  it('resolves the next weekly season target', () => {
    const next = getNextTowerSeasonMeta(new Date('2026-06-05T10:00:00.000Z'));

    expect(next.seasonKey).toBe('2026-W24@Asia/Shanghai');
    expect(next.seasonStartedAt).toBe('2026-06-07T16:00:00.000Z');
  });
});
