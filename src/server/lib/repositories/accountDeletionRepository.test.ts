import { db, getExecutor } from '@server/lib/drizzle/db';
import {
  accountDeletionRecords,
  cultivators,
} from '@server/lib/drizzle/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  markAccountDeletionCompleted,
  recordPendingAccountDeletion,
} from './accountDeletionRepository';

vi.mock('@server/lib/drizzle/db', () => ({
  db: vi.fn(),
  getExecutor: vi.fn(),
}));

describe('accountDeletionRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      label: 'all associated cultivators',
      rows: [{ id: 'cultivator-1' }, { id: 'cultivator-2' }],
      expectedIds: ['cultivator-1', 'cultivator-2'],
    },
    {
      label: 'an empty cultivator list',
      rows: [],
      expectedIds: [],
    },
  ])('records $label before deletion', async ({ rows, expectedIds }) => {
    const where = vi.fn().mockResolvedValue(rows);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    const transaction = vi.fn(async (callback) => callback({ select, insert }));
    vi.mocked(db).mockReturnValue({ transaction } as never);

    await recordPendingAccountDeletion('11111111-1111-4111-8111-111111111111');

    expect(select).toHaveBeenCalledWith({ id: cultivators.id });
    expect(from).toHaveBeenCalledWith(cultivators);
    expect(values).toHaveBeenCalledWith({
      userId: '11111111-1111-4111-8111-111111111111',
      cultivatorIds: expectedIds,
      status: 'pending',
      requestedAt: expect.any(Date),
      completedAt: null,
    });
    expect(onConflictDoUpdate).toHaveBeenCalledWith({
      target: accountDeletionRecords.userId,
      set: {
        cultivatorIds: expectedIds,
        status: 'pending',
        requestedAt: expect.any(Date),
        completedAt: null,
      },
    });
  });

  it('propagates capture failures so Better Auth can abort deletion', async () => {
    const error = new Error('database unavailable');
    const transaction = vi.fn().mockRejectedValue(error);
    vi.mocked(db).mockReturnValue({ transaction } as never);

    await expect(
      recordPendingAccountDeletion('11111111-1111-4111-8111-111111111111'),
    ).rejects.toBe(error);
  });

  it('marks the captured record completed after Better Auth deletes the user', async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    vi.mocked(getExecutor).mockReturnValue({ update } as never);

    await markAccountDeletionCompleted('11111111-1111-4111-8111-111111111111');

    expect(update).toHaveBeenCalledWith(accountDeletionRecords);
    expect(set).toHaveBeenCalledWith({
      status: 'completed',
      completedAt: expect.any(Date),
    });
    expect(where).toHaveBeenCalledOnce();
  });
});
