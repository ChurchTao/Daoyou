import { Hono } from 'hono';

const { getExecutorMock, findPublishedItemLibraryForSelectionsMock } = vi.hoisted(() => ({
  getExecutorMock: vi.fn(),
  findPublishedItemLibraryForSelectionsMock: vi.fn(),
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

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: getExecutorMock,
}));

vi.mock('@server/lib/repositories/itemLibraryRepository', () => ({
  findPublishedItemLibraryForSelections: findPublishedItemLibraryForSelectionsMock,
}));

import redeemCodesRouter from './redeem-codes.router';

function createApp() {
  return new Hono().route('/api/admin/redeem-codes', redeemCodesRouter);
}

describe('admin redeem codes router', () => {
  const sampleItems = [
    {
      id: '11111111-1111-4111-8111-111111111111',
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
        element: '金' as const,
      },
      editorConfig: {},
      createdBy: '11111111-1111-4111-8111-111111111111',
      updatedBy: '11111111-1111-4111-8111-111111111111',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates redeem codes with resolved reward attachments snapshots', async () => {
    const returningMock = vi.fn().mockResolvedValue([
      {
        id: 'redeem-1',
        code: 'SPRING2026',
      },
    ]);
    const valuesMock = vi.fn().mockReturnValue({
      returning: returningMock,
    });
    const insertMock = vi.fn().mockReturnValue({
      values: valuesMock,
    });

    getExecutorMock.mockReturnValue({
      insert: insertMock,
    });
    findPublishedItemLibraryForSelectionsMock.mockResolvedValue(sampleItems);

    const response = await createApp().request('/api/admin/redeem-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'SPRING2026',
        rewardSelections: [
          { type: 'spirit_stones', quantity: 500 },
          { type: 'item_library', itemId: 'refined_iron', quantity: 2 },
        ],
        mailTitle: '活动奖励',
        mailContent: '请查收奖励。',
      }),
    });

    expect(response.status).toBe(200);
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'SPRING2026',
        rewardPresetId: '__item_library_snapshot__',
        rewardAttachments: [
          {
            type: 'spirit_stones',
            name: '灵石',
            quantity: 500,
          },
          {
            type: 'material',
            name: '精炼玄铁',
            quantity: 2,
            data: {
              name: '精炼玄铁',
              type: 'ore',
              rank: '玄品',
              element: '金',
              quantity: 2,
            },
          },
        ],
      }),
    );
  });

  it('rejects missing item library items', async () => {
    getExecutorMock.mockReturnValue({
      insert: vi.fn(),
    });
    findPublishedItemLibraryForSelectionsMock.mockResolvedValue(sampleItems);

    const response = await createApp().request('/api/admin/redeem-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rewardSelections: [
          { type: 'item_library', itemId: 'missing', quantity: 1 },
        ],
        mailTitle: '活动奖励',
        mailContent: '请查收奖励。',
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: '道具库道具不存在：missing',
    });
  });

  it('marks legacy redeem codes without reward attachments as expired in list output', async () => {
    getExecutorMock.mockReturnValue({
      query: {
        redeemCodes: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'legacy-code-1',
              code: 'OLD2025',
              rewardPresetId: 'legacy_bundle',
              rewardAttachments: null,
              status: 'active',
              totalLimit: null,
              claimedCount: 0,
              startsAt: null,
              endsAt: null,
              createdAt: '2026-05-01T00:00:00.000Z',
            },
          ]),
        },
      },
    });

    const response = await createApp().request('/api/admin/redeem-codes');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      redeemCodes: [
        expect.objectContaining({
          code: 'OLD2025',
          rewardSummary: ['旧版兑换码（已失效）'],
          rewardSource: 'expired_legacy',
        }),
      ],
    });
  });

  it('marks snapshot-backed codes without attachments as broken instead of legacy', async () => {
    getExecutorMock.mockReturnValue({
      query: {
        redeemCodes: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'snapshot-code-1',
              code: 'NEW2026',
              rewardPresetId: '__item_library_snapshot__',
              rewardAttachments: null,
              status: 'active',
              totalLimit: null,
              claimedCount: 0,
              startsAt: null,
              endsAt: null,
              createdAt: '2026-05-01T00:00:00.000Z',
            },
          ]),
        },
      },
    });

    const response = await createApp().request('/api/admin/redeem-codes');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      redeemCodes: [
        expect.objectContaining({
          code: 'NEW2026',
          rewardSummary: ['奖励快照异常'],
          rewardSource: 'broken_snapshot',
        }),
      ],
    });
  });
});
