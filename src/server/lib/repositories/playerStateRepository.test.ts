import { describe, expect, it, vi } from 'vitest';

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: vi.fn(),
}));

import {
  insertStateEvents,
  mapPlayerStateEventRow,
  prunePlayerStateEventsOlderThan,
} from './playerStateRepository';

describe('playerStateRepository', () => {
  it('writes each event with its own domain version and preserves row order', async () => {
    const valuesMock = vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([
        {
          id: 10,
          cultivatorId: 'cultivator-1',
          userId: 'user-1',
          globalVersion: 8,
          domainVersion: 3,
          domain: 'currency',
          eventType: 'currency.changed',
          patch: { currency: { spiritStones: 10 } },
          invalidates: [],
          source: 'test',
          requestId: null,
          createdAt: new Date('2026-06-10T00:00:00.000Z'),
        },
        {
          id: 11,
          cultivatorId: 'cultivator-1',
          userId: 'user-1',
          globalVersion: 8,
          domainVersion: 5,
          domain: 'inventory',
          eventType: 'inventory.changed',
          patch: {},
          invalidates: ['inventory'],
          source: 'test',
          requestId: null,
          createdAt: new Date('2026-06-10T00:00:01.000Z'),
        },
      ]),
    }));
    const tx = {
      insert: vi.fn(() => ({ values: valuesMock })),
    };

    const events = await insertStateEvents(tx as any, {
      userId: 'user-1',
      cultivatorId: 'cultivator-1',
      globalVersion: 8,
      domainVersions: {
        currency: 3,
        inventory: 5,
      },
      events: [
        {
          domain: 'currency',
          eventType: 'currency.changed',
          patch: { currency: { spiritStones: 10 } },
          source: 'test',
        },
        {
          domain: 'inventory',
          eventType: 'inventory.changed',
          invalidates: ['inventory'],
          source: 'test',
        },
      ],
    });

    expect(valuesMock).toHaveBeenCalledWith([
      expect.objectContaining({
        globalVersion: 8,
        domain: 'currency',
        domainVersion: 3,
      }),
      expect.objectContaining({
        globalVersion: 8,
        domain: 'inventory',
        domainVersion: 5,
      }),
    ]);
    expect(events.map((event) => event.id)).toEqual([10, 11]);
    expect(events.map((event) => event.domainVersion)).toEqual([3, 5]);
  });

  it('maps event rows with domainVersion', () => {
    expect(
      mapPlayerStateEventRow({
        id: 1,
        cultivatorId: 'cultivator-1',
        userId: 'user-1',
        globalVersion: 2,
        domainVersion: 4,
        domain: 'mail',
        eventType: 'mail.changed',
        patch: { unreadMailCount: 1 },
        invalidates: null,
        source: 'test',
        requestId: null,
        createdAt: new Date('2026-06-10T00:00:00.000Z'),
      } as any),
    ).toEqual({
      id: 1,
      cultivatorId: 'cultivator-1',
      globalVersion: 2,
      domainVersion: 4,
      domain: 'mail',
      eventType: 'mail.changed',
      patch: { unreadMailCount: 1 },
      invalidates: [],
      source: 'test',
      createdAt: '2026-06-10T00:00:00.000Z',
    });
  });

  it('returns the number of pruned retention rows', async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const whereMock = vi.fn(() => ({ returning: returningMock }));
    const tx = {
      delete: vi.fn(() => ({ where: whereMock })),
    };

    await expect(
      prunePlayerStateEventsOlderThan(
        new Date('2026-06-03T00:00:00.000Z'),
        tx as any,
      ),
    ).resolves.toBe(2);
  });
});
