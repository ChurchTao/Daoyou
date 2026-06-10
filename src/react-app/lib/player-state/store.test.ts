import type {
  PlayerStateEvent,
  PlayerStateSnapshotResponse,
} from '@shared/contracts/player';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlayerStateStore } from './store';

function createEvent(
  overrides: Partial<PlayerStateEvent> = {},
): PlayerStateEvent {
  return {
    id: 1,
    cultivatorId: 'cultivator-1',
    globalVersion: 1,
    domainVersion: 1,
    domain: 'mail',
    eventType: 'mail.changed',
    patch: { unreadMailCount: 2 },
    invalidates: [],
    source: 'test',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createSnapshotResponse(
  snapshot: PlayerStateSnapshotResponse['data']['snapshot'],
  globalVersion = 2,
  cultivatorId = 'cultivator-1',
): PlayerStateSnapshotResponse {
  return {
    success: true,
    data: {
      cultivatorId,
      globalVersion,
      domainVersions: {
        profile: 0,
        condition: 0,
        progress: 0,
        currency: 0,
        inventory: 2,
        products: 0,
        mail: 1,
        tasks: 0,
      },
      snapshot,
      serverTime: '2026-01-01T00:00:00.000Z',
    },
  };
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

async function flushAsyncWork() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PlayerStateStore', () => {
  it('applies all events from one transaction when they share a global version', () => {
    const store = new PlayerStateStore();

    store.applyEvents([
      createEvent({
        id: 1,
        globalVersion: 1,
        domainVersion: 1,
        domain: 'mail',
        patch: { unreadMailCount: 3 },
      }),
      createEvent({
        id: 2,
        globalVersion: 1,
        domainVersion: 1,
        domain: 'currency',
        eventType: 'currency.changed',
        patch: { currency: { spiritStones: 88 } },
      }),
    ]);

    const snapshot = store.getSnapshot();
    expect(snapshot.globalVersion).toBe(1);
    expect(snapshot.snapshot.mail?.unreadCount).toBe(3);
    expect(snapshot.snapshot.currency?.spiritStones).toBe(88);
  });

  it('ignores events older than the local state version', () => {
    const store = new PlayerStateStore();

    store.applyEvents([
      createEvent({
        id: 1,
        globalVersion: 1,
        domainVersion: 1,
        domain: 'mail',
        patch: { unreadMailCount: 3 },
      }),
      createEvent({
        id: 2,
        globalVersion: 2,
        domainVersion: 2,
        domain: 'mail',
        patch: { unreadMailCount: 4 },
      }),
    ]);
    store.applyEvents([
      createEvent({
        id: 3,
        globalVersion: 1,
        domainVersion: 1,
        domain: 'mail',
        patch: { unreadMailCount: 99 },
      }),
    ]);

    expect(store.getSnapshot().snapshot.mail?.unreadCount).toBe(4);
  });

  it('recovers a version gap by fetching missing events', async () => {
    const store = new PlayerStateStore();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(createSnapshotResponse({}, 1)))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            after: 1,
            requiresSnapshot: false,
            events: [
              createEvent({
                id: 2,
                globalVersion: 2,
                domainVersion: 1,
                domain: 'currency',
                eventType: 'currency.changed',
                patch: { currency: { spiritStones: 40 } },
              }),
              createEvent({
                id: 3,
                globalVersion: 3,
                domainVersion: 2,
                domain: 'mail',
                patch: { unreadMailCount: 5 },
              }),
            ],
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await store.refresh(undefined, 'user-1');
    store.applyEvents([
      createEvent({ id: 3, globalVersion: 3, patch: { unreadMailCount: 5 } }),
    ]);

    await flushAsyncWork();

    expect(fetchMock).toHaveBeenCalledWith('/api/player/state/events?after=1');
    expect(store.getSnapshot().globalVersion).toBe(3);
    expect(store.getSnapshot().snapshot.currency?.spiritStones).toBe(40);
    expect(store.getSnapshot().snapshot.mail?.unreadCount).toBe(5);
  });

  it('refreshes stale domains after invalidate-only events', async () => {
    const store = new PlayerStateStore();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(createSnapshotResponse({}, 0)))
      .mockResolvedValueOnce(
        jsonResponse(
          createSnapshotResponse({
            inventory: {
              artifacts: [],
              consumables: [],
              materials: [{ id: 'material-1', name: '灵草', quantity: 3 }],
            },
          }),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    await store.refresh(undefined, 'user-1');
    store.applyEvents([
      createEvent({
        domain: 'inventory',
        domainVersion: 3,
        eventType: 'inventory.changed',
        patch: {},
        invalidates: ['inventory'],
      }),
    ]);

    await flushAsyncWork();

    expect(fetchMock).toHaveBeenCalledWith('/api/player/state?domains=inventory');
    expect(store.getSnapshot().staleDomains.size).toBe(0);
    expect(store.getSnapshot().snapshot.inventory?.materials).toEqual([
      { id: 'material-1', name: '灵草', quantity: 3 },
    ]);
  });

  it('merges mutation domain versions and ignores duplicate events', async () => {
    const store = new PlayerStateStore();
    const event = createEvent({
      id: 10,
      globalVersion: 1,
      domainVersion: 5,
      domain: 'mail',
      patch: { unreadMailCount: 7 },
    });

    await store.mutate(
      Promise.resolve({
        success: true,
        data: { ok: true },
        state: {
          cultivatorId: 'cultivator-1',
          globalVersion: 1,
          domainVersions: { mail: 5 },
          events: [event],
        },
      }),
    );
    store.applyEvents([event]);

    const snapshot = store.getSnapshot();
    expect(snapshot.globalVersion).toBe(1);
    expect(snapshot.domainVersions.mail).toBe(5);
    expect(snapshot.snapshot.mail?.unreadCount).toBe(7);
  });

  it('refreshes snapshot when event recovery requires a snapshot', async () => {
    const store = new PlayerStateStore();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(createSnapshotResponse({}, 1)))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            after: 1,
            requiresSnapshot: true,
            events: [],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          createSnapshotResponse({
            mail: { unreadCount: 12 },
          }, 9),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    await store.refresh(undefined, 'user-1');
    store.applyEvents([
      createEvent({ id: 9, globalVersion: 9, patch: { unreadMailCount: 12 } }),
    ]);

    await flushAsyncWork();

    expect(fetchMock).toHaveBeenCalledWith('/api/player/state/events?after=1');
    expect(fetchMock).toHaveBeenCalledWith('/api/player/state');
    expect(store.getSnapshot().globalVersion).toBe(9);
    expect(store.getSnapshot().snapshot.mail?.unreadCount).toBe(12);
  });

  it('clears old snapshot when refresh returns a different cultivator', async () => {
    const store = new PlayerStateStore();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          createSnapshotResponse({
            mail: { unreadCount: 3 },
            currency: {
              spiritStones: 99,
              qi: 8,
              qiLastRefreshedAt: null,
            },
          }, 1, 'cultivator-1'),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          createSnapshotResponse({
            mail: { unreadCount: 1 },
          }, 1, 'cultivator-2'),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    await store.refresh(undefined, 'user-1');
    await store.refresh(undefined, 'user-1');

    const snapshot = store.getSnapshot();
    expect(snapshot.cultivatorId).toBe('cultivator-2');
    expect(snapshot.snapshot.mail?.unreadCount).toBe(1);
    expect(snapshot.snapshot.currency).toBeUndefined();
  });

  it('does not apply mutation events from another cultivator', async () => {
    const store = new PlayerStateStore();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(createSnapshotResponse({}, 1)))
      .mockResolvedValueOnce(
        jsonResponse(
          createSnapshotResponse({
            mail: { unreadCount: 2 },
          }, 4, 'cultivator-2'),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    await store.refresh(undefined, 'user-1');
    const result = await store.mutate(
      Promise.resolve({
        success: true,
        data: { ok: true },
        state: {
          cultivatorId: 'cultivator-2',
          globalVersion: 4,
          domainVersions: { mail: 4 },
          events: [
            createEvent({
              id: 11,
              cultivatorId: 'cultivator-2',
              globalVersion: 4,
              domainVersion: 4,
              patch: { unreadMailCount: 99 },
            }),
          ],
        },
      }),
    );

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/player/state');
    expect(store.getSnapshot().cultivatorId).toBe('cultivator-2');
    expect(store.getSnapshot().snapshot.mail?.unreadCount).toBe(2);
  });
});
