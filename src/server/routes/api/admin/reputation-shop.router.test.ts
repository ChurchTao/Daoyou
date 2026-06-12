import { Hono } from 'hono';

const {
  archiveReputationShopItemMock,
  createReputationShopItemMock,
  listReputationShopItemsMock,
  ReputationShopErrorMock,
  updateReputationShopItemMock,
} = vi.hoisted(() => ({
  archiveReputationShopItemMock: vi.fn(),
  createReputationShopItemMock: vi.fn(),
  listReputationShopItemsMock: vi.fn(),
  ReputationShopErrorMock: class ReputationShopError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
  updateReputationShopItemMock: vi.fn(),
}));

vi.mock('@server/lib/hono/middleware', () => ({
  requireAdmin: () => async (context: any, next: () => Promise<void>) => {
    context.set('user', {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'admin@example.com',
    });
    await next();
  },
}));

vi.mock('@server/lib/hono/response', () => ({
  jsonWithStatus: (context: any, body: unknown, status: number) =>
    context.json(body, status),
}));

vi.mock('@server/lib/services/ReputationShopService', () => ({
  archiveReputationShopItem: archiveReputationShopItemMock,
  createReputationShopItem: createReputationShopItemMock,
  listReputationShopItems: listReputationShopItemsMock,
  updateReputationShopItem: updateReputationShopItemMock,
  ReputationShopError: ReputationShopErrorMock,
}));

import reputationShopAdminRouter from './reputation-shop.router';

function createApp() {
  return new Hono().route(
    '/api/admin/reputation-shop',
    reputationShopAdminRouter,
  );
}

describe('admin reputation shop router', () => {
  const shopItem = {
    id: '22222222-2222-4222-8222-222222222222',
    itemLibraryItemId: 'refined_iron',
    price: 1000,
    quantity: 2,
    perUserLimit: 3,
    status: 'active' as const,
    sortOrder: 0,
    purchasedCount: 0,
    remainingPurchases: null,
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
  });

  it('lists configured shop items', async () => {
    listReputationShopItemsMock.mockResolvedValueOnce([shopItem]);

    const response = await createApp().request(
      '/api/admin/reputation-shop?status=active',
    );

    expect(response.status).toBe(200);
    expect(listReputationShopItemsMock).toHaveBeenCalledWith({
      status: 'active',
    });
    await expect(response.json()).resolves.toEqual({ items: [shopItem] });
  });

  it('creates shop items', async () => {
    createReputationShopItemMock.mockResolvedValueOnce(shopItem);

    const response = await createApp().request('/api/admin/reputation-shop', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        itemLibraryItemId: 'refined_iron',
        price: 1000,
        quantity: 2,
        perUserLimit: 3,
        status: 'active',
        sortOrder: 10,
      }),
    });

    expect(response.status).toBe(200);
    expect(createReputationShopItemMock).toHaveBeenCalledWith({
      input: expect.objectContaining({
        itemLibraryItemId: 'refined_iron',
        price: 1000,
      }),
      userId: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('rejects price above the reputation cap', async () => {
    const response = await createApp().request('/api/admin/reputation-shop', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        itemLibraryItemId: 'refined_iron',
        price: 10000,
        quantity: 2,
        perUserLimit: 3,
        status: 'active',
        sortOrder: 10,
      }),
    });

    expect(response.status).toBe(400);
    expect(createReputationShopItemMock).not.toHaveBeenCalled();
  });

  it('accepts the maximum reputation price', async () => {
    createReputationShopItemMock.mockResolvedValueOnce({
      ...shopItem,
      price: 9999,
    });

    const response = await createApp().request('/api/admin/reputation-shop', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        itemLibraryItemId: 'refined_iron',
        price: 9999,
        quantity: 2,
        perUserLimit: 3,
        status: 'active',
        sortOrder: 10,
      }),
    });

    expect(response.status).toBe(200);
    expect(createReputationShopItemMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ price: 9999 }),
      }),
    );
  });

  it('rejects stacked quantity above 30 before service calls', async () => {
    const response = await createApp().request('/api/admin/reputation-shop', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        itemLibraryItemId: 'refined_iron',
        price: 9999,
        quantity: 31,
        perUserLimit: 3,
        status: 'active',
        sortOrder: 10,
      }),
    });

    expect(response.status).toBe(400);
    expect(createReputationShopItemMock).not.toHaveBeenCalled();
  });

  it('maps service rejection for artifact quantity above 1', async () => {
    createReputationShopItemMock.mockRejectedValueOnce(
      new ReputationShopErrorMock(400, '法宝类商品每次只能发放 1 件'),
    );

    const response = await createApp().request('/api/admin/reputation-shop', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        itemLibraryItemId: 'artifact_sword',
        price: 100,
        quantity: 2,
        perUserLimit: 3,
        status: 'active',
        sortOrder: 10,
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: '法宝类商品每次只能发放 1 件',
    });
  });

  it('archives shop items', async () => {
    archiveReputationShopItemMock.mockResolvedValueOnce({
      ...shopItem,
      status: 'archived',
    });

    const response = await createApp().request(
      '/api/admin/reputation-shop/22222222-2222-4222-8222-222222222222/archive',
      { method: 'POST' },
    );

    expect(response.status).toBe(200);
    expect(archiveReputationShopItemMock).toHaveBeenCalledWith({
      id: '22222222-2222-4222-8222-222222222222',
      userId: '11111111-1111-4111-8111-111111111111',
    });
  });
});
