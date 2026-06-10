import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  transactionMock,
  bumpStateVersionsMock,
  insertStateEventsMock,
  publishPlayerStateEventsMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  bumpStateVersionsMock: vi.fn(),
  insertStateEventsMock: vi.fn(),
  publishPlayerStateEventsMock: vi.fn(),
}));

vi.mock('@server/lib/drizzle/db', () => ({
  db: () => ({
    transaction: transactionMock,
  }),
}));

vi.mock('@server/lib/repositories/playerStateRepository', () => ({
  bumpStateVersions: bumpStateVersionsMock,
  insertStateEvents: insertStateEventsMock,
}));

vi.mock('@server/lib/services/playerStateBroadcaster', () => ({
  publishPlayerStateEvents: publishPlayerStateEventsMock,
}));

import { commitPlayerStateMutation } from './PlayerStateMutationService';

describe('PlayerStateMutationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (callback) => callback('tx'));
    bumpStateVersionsMock.mockResolvedValue({
      globalVersion: 8,
      domainVersions: {
        profile: 0,
        condition: 0,
        progress: 0,
        currency: 3,
        inventory: 5,
        products: 0,
        mail: 0,
        tasks: 0,
      },
    });
    insertStateEventsMock.mockResolvedValue([
      {
        id: 1,
        cultivatorId: 'cultivator-1',
        globalVersion: 8,
        domainVersion: 3,
        domain: 'currency',
        eventType: 'currency.changed',
        patch: {},
        invalidates: ['currency'],
        source: 'test',
        createdAt: '2026-06-10T00:00:00.000Z',
      },
    ]);
  });

  it('runs domain writes, version bump, and event insert in one transaction', async () => {
    const run = vi.fn(async () => ({
      result: { ok: true },
      changes: [
        {
          domain: 'currency' as const,
          eventType: 'currency.changed',
          invalidates: ['currency' as const],
        },
        {
          domain: 'inventory' as const,
          eventType: 'inventory.changed',
          invalidates: ['inventory' as const],
        },
      ],
    }));

    const committed = await commitPlayerStateMutation({
      userId: 'user-1',
      cultivatorId: 'cultivator-1',
      source: 'test',
      run,
    });

    expect(run).toHaveBeenCalledWith('tx');
    expect(bumpStateVersionsMock).toHaveBeenCalledWith('tx', 'cultivator-1', [
      'currency',
      'inventory',
    ]);
    expect(insertStateEventsMock).toHaveBeenCalledWith('tx', {
      userId: 'user-1',
      cultivatorId: 'cultivator-1',
      globalVersion: 8,
      domainVersions: expect.objectContaining({
        currency: 3,
        inventory: 5,
      }),
      events: [
        expect.objectContaining({ domain: 'currency', source: 'test' }),
        expect.objectContaining({ domain: 'inventory', source: 'test' }),
      ],
    });
    expect(committed.state.domainVersions).toEqual({
      currency: 3,
      inventory: 5,
    });
    expect(publishPlayerStateEventsMock).toHaveBeenCalledTimes(1);
  });

  it('does not write versions or events when the domain mutation fails', async () => {
    await expect(
      commitPlayerStateMutation({
        userId: 'user-1',
        cultivatorId: 'cultivator-1',
        source: 'test',
        run: async () => {
          throw new Error('domain failed');
        },
      }),
    ).rejects.toThrow('domain failed');

    expect(bumpStateVersionsMock).not.toHaveBeenCalled();
    expect(insertStateEventsMock).not.toHaveBeenCalled();
    expect(publishPlayerStateEventsMock).not.toHaveBeenCalled();
  });

  it('lets event insert failures reject the transaction and skip publish', async () => {
    insertStateEventsMock.mockRejectedValueOnce(new Error('event insert failed'));

    await expect(
      commitPlayerStateMutation({
        userId: 'user-1',
        cultivatorId: 'cultivator-1',
        source: 'test',
        run: async () => ({
          result: { ok: true },
          changes: [
            {
              domain: 'currency' as const,
              eventType: 'currency.changed',
            },
          ],
        }),
      }),
    ).rejects.toThrow('event insert failed');

    expect(publishPlayerStateEventsMock).not.toHaveBeenCalled();
  });
});
