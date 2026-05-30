import { Hono } from 'hono';

const { getRewardCatalogMock, upsertRewardCatalogMock } = vi.hoisted(() => ({
  getRewardCatalogMock: vi.fn(),
  upsertRewardCatalogMock: vi.fn(),
}));

vi.mock('@server/lib/hono/middleware', () => ({
  requireAdmin: () => async (context: any, next: () => Promise<void>) => {
    context.set('user', {
      id: 'admin-user-1',
      email: 'admin@example.com',
    });
    await next();
  },
}));

vi.mock('@server/lib/repositories/rewardCatalogRepository', () => ({
  getRewardCatalog: getRewardCatalogMock,
  upsertRewardCatalog: upsertRewardCatalogMock,
}));

import rewardCatalogRouter from './reward-catalog.router';

function createApp() {
  return new Hono().route('/api/admin/reward-catalog', rewardCatalogRouter);
}

describe('admin reward catalog router', () => {
  const sampleCatalog = [
    {
      id: 'refined_iron',
      type: 'material' as const,
      data: {
        name: '精炼玄铁',
        type: 'ore' as const,
        rank: '玄品' as const,
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the stored reward catalog', async () => {
    getRewardCatalogMock.mockResolvedValueOnce(sampleCatalog);

    const response = await createApp().request('/api/admin/reward-catalog');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      catalog: sampleCatalog,
    });
  });

  it('persists the reward catalog', async () => {
    const response = await createApp().request('/api/admin/reward-catalog', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        catalog: sampleCatalog,
      }),
    });

    expect(response.status).toBe(200);
    expect(upsertRewardCatalogMock).toHaveBeenCalledWith({
      catalog: sampleCatalog,
      updatedBy: 'admin-user-1',
    });
    await expect(response.json()).resolves.toEqual({
      ok: true,
      catalog: sampleCatalog,
    });
  });

  it('rejects invalid reward catalog payloads', async () => {
    const response = await createApp().request('/api/admin/reward-catalog', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        catalog: [
          {
            id: 'bad-item',
            type: 'material',
            data: {
              name: '坏数据',
            },
          },
        ],
      }),
    });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error?: string };
    expect(payload.error).toBe('参数错误');
  });
});
