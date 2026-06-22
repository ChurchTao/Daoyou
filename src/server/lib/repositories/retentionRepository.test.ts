import { describe, expect, it, vi } from 'vitest';

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: vi.fn(),
}));

import { pruneExpiredData } from './retentionRepository';

function flattenSqlObject(value: unknown, seen = new Set<unknown>()): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object' || seen.has(value)) return '';
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => flattenSqlObject(item, seen)).join(' ');
  }
  return Object.values(value as Record<string, unknown>)
    .map((item) => flattenSqlObject(item, seen))
    .join(' ');
}

describe('retentionRepository', () => {
  it('keeps old mails with unclaimed attachments when pruning expired data', async () => {
    const returningMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn(() => ({ returning: returningMock }));
    const deleteMock = vi.fn(() => ({ where: whereMock }));
    const q = { delete: deleteMock };
    const cutoff = new Date('2026-06-01T00:00:00.000Z');

    await pruneExpiredData(
      {
        mails: cutoff,
        qiLogs: cutoff,
        dungeonHistories: cutoff,
        dungeonRuns: cutoff,
        battleRecordsV2: cutoff,
        reputationShopPurchases: cutoff,
        auctionListings: cutoff,
      },
      q as any,
    );

    const mailWhereSql = flattenSqlObject((whereMock.mock.calls as unknown[][])[0]?.[0]);
    expect(mailWhereSql).toContain('jsonb_array_length');
    expect(mailWhereSql).toContain('is_claimed');
    expect(mailWhereSql).toContain('attachments');
  });
});
