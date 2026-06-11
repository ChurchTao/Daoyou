import { describe, expect, it } from 'vitest';
import { deriveQiState } from './useQiState';

describe('deriveQiState', () => {
  it('derives next restore and full restore times from the settlement baseline', () => {
    const state = deriveQiState({
      current: 40,
      qiLastRefreshedAt: new Date('2026-06-06T00:00:00+08:00').toISOString(),
      nowMs: new Date('2026-06-06T02:20:00+08:00').getTime(),
    });

    expect(state.current).toBe(60);
    expect(state.recovery).toMatchObject({
      status: 'recovering',
      nextRestoreAt: new Date('2026-06-06T03:00:00+08:00').toISOString(),
      fullRestoreAt: new Date('2026-06-06T16:00:00+08:00').toISOString(),
      nextRestoreInMs: 40 * 60 * 1000,
      fullRestoreInMs: 13 * 60 * 60 * 1000 + 40 * 60 * 1000,
    });
  });

  it('stops natural recovery countdown while qi is at or above the natural max', () => {
    expect(
      deriveQiState({
        current: 200,
        qiLastRefreshedAt: new Date('2026-06-06T00:00:00+08:00').toISOString(),
        nowMs: new Date('2026-06-06T02:20:00+08:00').getTime(),
      }).recovery.status,
    ).toBe('full');

    const overflow = deriveQiState({
      current: 260,
      qiLastRefreshedAt: new Date('2026-06-06T00:00:00+08:00').toISOString(),
      nowMs: new Date('2026-06-06T02:20:00+08:00').getTime(),
    });

    expect(overflow.current).toBe(260);
    expect(overflow.recovery).toMatchObject({
      status: 'overflow',
      nextRestoreAt: null,
      fullRestoreAt: null,
    });
  });
});
