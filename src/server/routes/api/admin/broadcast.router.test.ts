import { Hono } from 'hono';

const {
  getExecutorMock,
  getRewardCatalogMock,
  resolveEmailRecipientsMock,
  resolveGameMailRecipientsMock,
} = vi.hoisted(() => ({
  getExecutorMock: vi.fn(),
  getRewardCatalogMock: vi.fn(),
  resolveEmailRecipientsMock: vi.fn(),
  resolveGameMailRecipientsMock: vi.fn(),
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

vi.mock('@server/lib/repositories/rewardCatalogRepository', () => ({
  getRewardCatalog: getRewardCatalogMock,
}));

vi.mock('@server/lib/admin/recipient-resolver', () => ({
  resolveEmailRecipients: resolveEmailRecipientsMock,
  resolveGameMailRecipients: resolveGameMailRecipientsMock,
}));

import broadcastRouter from './broadcast.router';

function createApp() {
  return new Hono().route('/api/admin/broadcast', broadcastRouter);
}

describe('admin broadcast router', () => {
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
    resolveEmailRecipientsMock.mockResolvedValue({
      totalCount: 0,
      recipients: [],
      sampleRecipients: [],
    });
    resolveGameMailRecipientsMock.mockResolvedValue({
      totalCount: 2,
      recipients: [
        { recipientKey: 'cultivator-1' },
        { recipientKey: 'cultivator-2' },
      ],
      sampleRecipients: [{ recipientKey: 'cultivator-1' }],
    });
  });

  it('sends pure system mails when reward selections are empty', async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    getExecutorMock.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        values: valuesMock,
      }),
      query: {
        adminMessageTemplates: {
          findFirst: vi.fn(),
        },
      },
    });
    getRewardCatalogMock.mockResolvedValue([]);

    const response = await createApp().request('/api/admin/broadcast/game-mail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '维护公告',
        content: '今晚维护，请提前下线。',
        rewardSelections: [],
      }),
    });

    expect(response.status).toBe(200);
    expect(valuesMock).toHaveBeenCalledWith([
      expect.objectContaining({
        cultivatorId: 'cultivator-1',
        type: 'system',
        attachments: [],
      }),
      expect.objectContaining({
        cultivatorId: 'cultivator-2',
        type: 'system',
        attachments: [],
      }),
    ]);
    await expect(response.json()).resolves.toEqual({
      success: true,
      totalRecipients: 2,
      mailType: 'system',
      rewardSummary: [],
    });
  });

  it('resolves configured reward selections into reward mails', async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    getExecutorMock.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        values: valuesMock,
      }),
      query: {
        adminMessageTemplates: {
          findFirst: vi.fn(),
        },
      },
    });
    getRewardCatalogMock.mockResolvedValue(sampleCatalog);

    const response = await createApp().request('/api/admin/broadcast/game-mail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '补偿',
        content: '请查收补偿。',
        rewardSelections: [
          { type: 'spirit_stones', quantity: 300 },
          { type: 'catalog_item', itemId: 'refined_iron', quantity: 2 },
        ],
      }),
    });

    expect(response.status).toBe(200);
    expect(valuesMock).toHaveBeenCalledWith([
      expect.objectContaining({
        cultivatorId: 'cultivator-1',
        type: 'reward',
        attachments: [
          {
            type: 'spirit_stones',
            name: '灵石',
            quantity: 300,
          },
          {
            type: 'material',
            name: '精炼玄铁',
            quantity: 2,
            data: {
              name: '精炼玄铁',
              type: 'ore',
              rank: '玄品',
              quantity: 2,
            },
          },
        ],
      }),
      expect.objectContaining({
        cultivatorId: 'cultivator-2',
        type: 'reward',
      }),
    ]);
    await expect(response.json()).resolves.toEqual({
      success: true,
      totalRecipients: 2,
      mailType: 'reward',
      rewardSummary: ['灵石 x300', '精炼玄铁 x2'],
    });
  });

  it('supports single-send mode with targetCultivatorId', async () => {
    const targetCultivatorId = '11111111-1111-4111-8111-111111111111';
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    getExecutorMock.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        values: valuesMock,
      }),
      query: {
        adminMessageTemplates: {
          findFirst: vi.fn(),
        },
      },
    });
    getRewardCatalogMock.mockResolvedValue([]);
    resolveGameMailRecipientsMock.mockResolvedValue({
      totalCount: 1,
      recipients: [{ recipientKey: targetCultivatorId }],
      sampleRecipients: [
        {
          recipientKey: targetCultivatorId,
          metadata: {
            cultivatorId: targetCultivatorId,
            cultivatorName: '韩立',
            realm: '筑基',
          },
        },
      ],
    });

    const response = await createApp().request('/api/admin/broadcast/game-mail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '单发补偿',
        content: '只发给一个角色。',
        rewardSelections: [],
        filters: {
          targetCultivatorId,
          cultivatorCreatedFrom: '2026-05-01',
          realmMin: '元婴',
        },
      }),
    });

    expect(response.status).toBe(200);
    expect(resolveGameMailRecipientsMock).toHaveBeenCalledWith({
      targetCultivatorId,
      cultivatorCreatedFrom: '2026-05-01',
      realmMin: '元婴',
    });
    expect(valuesMock).toHaveBeenCalledWith([
      expect.objectContaining({
        cultivatorId: targetCultivatorId,
      }),
    ]);
    await expect(response.json()).resolves.toEqual({
      success: true,
      totalRecipients: 1,
      mailType: 'system',
      rewardSummary: [],
    });
  });
});
