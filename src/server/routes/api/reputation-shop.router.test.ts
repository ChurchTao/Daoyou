import { Hono } from 'hono';

const {
  buyReputationShopItemMock,
  commitPlayerStateMutationMock,
  listReputationShopItemsMock,
  redisDelMock,
  redisSetMock,
} = vi.hoisted(() => ({
  buyReputationShopItemMock: vi.fn(),
  commitPlayerStateMutationMock: vi.fn(async (input: any) => {
    const { result, changes } = await input.run({ __tx: true });
    return {
      result,
      state: {
        cultivatorId: input.cultivatorId,
        globalVersion: 7,
        domainVersions: Object.fromEntries(
          changes.map((change: any) => [change.domain, 7]),
        ),
        events: changes.map((change: any, index: number) => ({
          id: index + 1,
          cultivatorId: input.cultivatorId,
          globalVersion: 7,
          domainVersion: 7,
          domain: change.domain,
          eventType: change.eventType,
          patch: change.patch ?? {},
          invalidates: change.invalidates ?? [],
          source: input.source,
          createdAt: '2026-01-01T00:00:00.000Z',
        })),
      },
    };
  }),
  listReputationShopItemsMock: vi.fn(),
  redisDelMock: vi.fn(),
  redisSetMock: vi.fn(),
}));

vi.mock('@server/lib/hono/middleware', () => ({
  requireActiveCultivator:
    () => async (context: any, next: () => Promise<void>) => {
      context.set('user', { id: 'user-1' });
      context.set('cultivator', {
        id: '11111111-1111-4111-8111-111111111111',
        userId: 'user-1',
        reputation: 3200,
      });
      await next();
    },
}));

vi.mock('@server/lib/hono/response', () => ({
  jsonWithStatus: (context: any, body: unknown, status: number) =>
    context.json(body, status),
}));

vi.mock('@server/lib/redis', () => ({
  redis: {
    del: redisDelMock,
    set: redisSetMock,
  },
}));

vi.mock('@server/lib/services/PlayerStateMutationService', () => ({
  commitPlayerStateMutation: commitPlayerStateMutationMock,
  toPlayerStateMutationResponse: (committed: any) => ({
    success: true,
    data: committed.result,
    state: committed.state,
  }),
}));

vi.mock('@server/lib/services/ReputationShopService', () => ({
  buyReputationShopItem: buyReputationShopItemMock,
  listReputationShopItems: listReputationShopItemsMock,
  ReputationShopError: class ReputationShopError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));

import reputationShopRouter from './reputation-shop.router';

function createApp() {
  return new Hono().route('/api/reputation-shop', reputationShopRouter);
}

describe('reputation shop router', () => {
  const shopItem = {
    id: '22222222-2222-4222-8222-222222222222',
    itemLibraryItemId: 'refined_iron',
    price: 1000,
    quantity: 2,
    perUserLimit: 3,
    status: 'active' as const,
    sortOrder: 0,
    purchasedCount: 1,
    remainingPurchases: 2,
    item: {
      id: '33333333-3333-4333-8333-333333333333',
      itemId: 'refined_iron',
      type: 'material' as const,
      status: 'published' as const,
      name: '精炼玄铁',
      description: null,
      quality: '玄品',
      element: '金',
      category: 'ore',
      payload: {
        name: '精炼玄铁',
        type: 'ore' as const,
        rank: '玄品' as const,
      },
      editorConfig: {},
      createdBy: '11111111-1111-4111-8111-111111111111',
      updatedBy: '11111111-1111-4111-8111-111111111111',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    },
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    redisSetMock.mockResolvedValue('OK');
  });

  it('lists visible shop items with current reputation', async () => {
    listReputationShopItemsMock.mockResolvedValueOnce([shopItem]);

    const response = await createApp().request('/api/reputation-shop');

    expect(response.status).toBe(200);
    expect(listReputationShopItemsMock).toHaveBeenCalledWith({
      cultivatorId: '11111111-1111-4111-8111-111111111111',
      userVisibleOnly: true,
    });
    await expect(response.json()).resolves.toEqual({
      items: [shopItem],
      reputation: 3200,
    });
  });

  it('buys an item and emits currency plus inventory changes', async () => {
    buyReputationShopItemMock.mockResolvedValueOnce({
      item: shopItem,
      reputation: 2200,
      gains: [{ type: 'material', value: 2 }],
    });

    const response = await createApp().request(
      '/api/reputation-shop/22222222-2222-4222-8222-222222222222/buy',
      { method: 'POST' },
    );

    expect(response.status).toBe(200);
    expect(buyReputationShopItemMock).toHaveBeenCalledWith({
      id: '22222222-2222-4222-8222-222222222222',
      userId: 'user-1',
      cultivatorId: '11111111-1111-4111-8111-111111111111',
      tx: { __tx: true },
    });
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        state: expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({
              domain: 'currency',
              eventType: 'currency.reputation.spent',
              patch: { currency: { reputation: 2200 } },
            }),
            expect.objectContaining({
              domain: 'inventory',
              eventType: 'inventory.reputation_shop.gained',
            }),
          ]),
        }),
      }),
    );
    expect(redisSetMock).toHaveBeenCalledWith(
      'reputation-shop:buy:lock:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222',
      'locked',
      'EX',
      10,
      'NX',
    );
    expect(redisDelMock).toHaveBeenCalledWith(
      'reputation-shop:buy:lock:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222',
    );
  });

  it('rejects concurrent buys with a lock conflict', async () => {
    redisSetMock.mockResolvedValueOnce(null);

    const response = await createApp().request(
      '/api/reputation-shop/22222222-2222-4222-8222-222222222222/buy',
      { method: 'POST' },
    );

    expect(response.status).toBe(429);
    expect(commitPlayerStateMutationMock).not.toHaveBeenCalled();
    expect(buyReputationShopItemMock).not.toHaveBeenCalled();
    expect(redisDelMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: '兑换正在处理中，请稍后',
    });
  });
});
