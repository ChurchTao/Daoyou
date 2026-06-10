import { Hono } from 'hono';

const {
  batchBuyMarketItemsMock,
  buyMarketItemMock,
  confirmSellMock,
  getMarketListingsMock,
  previewSellMock,
  commitPlayerStateMutationMock,
  resolveLayerMock,
  resolveNodeIdMock,
} = vi.hoisted(() => ({
  batchBuyMarketItemsMock: vi.fn(),
  buyMarketItemMock: vi.fn(),
  confirmSellMock: vi.fn(),
  getMarketListingsMock: vi.fn(),
  previewSellMock: vi.fn(),
  commitPlayerStateMutationMock: vi.fn(async (input: any) => {
    const { result, changes } = await input.run({ __tx: true });
    return {
      result,
      state: {
        cultivatorId: input.cultivatorId,
        globalVersion: 12,
        domainVersions: Object.fromEntries(
          changes.map((change: any) => [change.domain, 12]),
        ),
        events: changes.map((change: any, index: number) => ({
          id: index + 1,
          cultivatorId: input.cultivatorId,
          globalVersion: 12,
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
  resolveLayerMock: vi.fn(() => 'common'),
  resolveNodeIdMock: vi.fn((value?: string | null) => value || 'node-1'),
}));

vi.mock('@server/lib/hono/middleware', () => ({
  requireActiveCultivator:
    () => async (context: any, next: () => Promise<void>) => {
      context.set('cultivator', {
        id: 'cultivator-1',
        userId: 'user-1',
        realm: '筑基',
      });
      await next();
    },
}));

vi.mock('@server/lib/hono/response', () => ({
  jsonWithStatus: (context: any, body: unknown, status: number) =>
    context.json(body, status),
}));

vi.mock('@server/lib/services/MarketService', () => ({
  batchBuyMarketItems: batchBuyMarketItemsMock,
  buyMarketItem: buyMarketItemMock,
  getMarketListings: getMarketListingsMock,
  MarketServiceError: class MarketServiceError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
  resolveLayer: resolveLayerMock,
  resolveNodeId: resolveNodeIdMock,
}));

vi.mock('@server/lib/services/MarketRecycleService', () => ({
  MarketRecycleError: class MarketRecycleError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
  confirmSell: confirmSellMock,
  previewSell: previewSellMock,
}));

vi.mock('@server/lib/services/PlayerStateMutationService', () => ({
  commitPlayerStateMutation: commitPlayerStateMutationMock,
  toPlayerStateMutationResponse: (committed: any) => ({
    success: true,
    data: committed.result,
    state: committed.state,
  }),
}));

import marketRouter from './market.router';

function createApp() {
  return new Hono().route('/api/market', marketRouter);
}

describe('market router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveLayerMock.mockReturnValue('common');
    resolveNodeIdMock.mockImplementation((value?: string | null) => value || 'node-1');
  });

  it('routes GET /:nodeId to getMarketListings with userId', async () => {
    getMarketListingsMock.mockResolvedValueOnce({
      listings: [],
      nextRefresh: Date.now() + 60_000,
      access: { allowed: true },
      marketFlavor: { title: '测试坊市', description: '测试描述' },
    });

    const response = await createApp().request('/api/market/node-1?layer=common');

    expect(response.status).toBe(200);
    expect(getMarketListingsMock).toHaveBeenCalledWith({
      nodeId: 'node-1',
      layer: 'common',
      userId: 'user-1',
      cultivatorRealm: '筑基',
    });
  });

  it('routes POST /sell preview to recycle handler', async () => {
    previewSellMock.mockResolvedValueOnce({
      success: true,
      itemType: 'material',
      sessionId: 'session-1',
      mode: 'high_single',
      items: [],
      totalSpiritStones: 1200,
      appraisal: {
        rating: 'B',
        comment: '此物可堪炼用。',
        keywords: ['本源'],
      },
      expiresAt: Date.now() + 60_000,
    });

    const response = await createApp().request('/api/market/sell', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        phase: 'preview',
        itemType: 'material',
        itemIds: ['material-1'],
      }),
    });

    expect(response.status).toBe(200);
    expect(previewSellMock).toHaveBeenCalledWith(
      { id: 'cultivator-1' },
      ['material-1'],
      'material',
    );
    expect(getMarketListingsMock).not.toHaveBeenCalled();
  });

  it('routes POST /sell confirm to recycle confirm handler', async () => {
    confirmSellMock.mockResolvedValueOnce({
      success: true,
      itemType: 'artifact',
      gainedSpiritStones: 888,
      soldItems: [],
      remainingSpiritStones: 1688,
    });

    const response = await createApp().request('/api/market/sell', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        phase: 'confirm',
        sessionId: 'session-2',
      }),
    });

    expect(response.status).toBe(200);
    expect(confirmSellMock).toHaveBeenCalledWith(
      'cultivator-1',
      'session-2',
      {
        tx: { __tx: true },
        deferSideEffects: true,
      },
    );
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        state: expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({
              domain: 'currency',
              eventType: 'currency.changed',
              patch: { currency: { spiritStones: 1688 } },
            }),
            expect.objectContaining({
              domain: 'products',
              eventType: 'products.changed',
              invalidates: ['products'],
            }),
          ]),
        }),
      }),
    );
  });

  it('routes POST /:nodeId/buy to buyMarketItem with userId', async () => {
    buyMarketItemMock.mockResolvedValueOnce({
      success: true,
      message: '成功购入',
    });

    const response = await createApp().request('/api/market/node-1/buy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        listingId: 'listing-1',
        quantity: 1,
        layer: 'common',
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        state: expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({
              domain: 'currency',
              eventType: 'currency.changed',
              invalidates: ['currency'],
            }),
            expect.objectContaining({
              domain: 'inventory',
              eventType: 'inventory.changed',
              invalidates: ['inventory'],
            }),
          ]),
        }),
      }),
    );
    expect(buyMarketItemMock).toHaveBeenCalledWith({
      nodeId: 'node-1',
      layer: 'common',
      listingId: 'listing-1',
      quantity: 1,
      userId: 'user-1',
      cultivatorId: 'cultivator-1',
      cultivatorRealm: '筑基',
      tx: { __tx: true },
      deferSideEffects: true,
    });
    expect(commitPlayerStateMutationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        cultivatorId: 'cultivator-1',
        source: 'market_buy',
      }),
    );
  });
});
