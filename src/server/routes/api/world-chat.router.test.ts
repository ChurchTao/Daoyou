import { jsonError } from '@server/lib/hono/middleware';
import type { WorldChatMessageDTO } from '@shared/types/world-chat';
import { Hono } from 'hono';

const {
  checkAndAcquireCooldownMock,
  createMessageMock,
  listLatestMessagesMock,
  listMessagesMock,
} = vi.hoisted(() => ({
  checkAndAcquireCooldownMock: vi.fn(),
  createMessageMock: vi.fn(),
  listLatestMessagesMock: vi.fn(),
  listMessagesMock: vi.fn(),
}));

vi.mock('@server/lib/hono/middleware', () => ({
  getValidatedJson: (context: any) => context.get('validatedJson'),
  getValidatedQuery: (context: any) => context.get('validatedQuery'),
  jsonError: () => async (context: any, next: () => Promise<void>) => {
    try {
      await next();
    } catch (error) {
      context.res = Response.json(
        {
          success: false,
          error: error instanceof Error ? error.message : '参数错误',
        },
        { status: 400 },
      );
    }
  },
  requireActiveCultivator:
    () => async (context: any, next: () => Promise<void>) => {
      context.set('user', { id: 'user-1', email: 'user@example.com' });
      context.set('cultivator', {
        id: 'cultivator-1',
        name: '林玄',
        realm: 'foundation',
        realm_stage: '筑基中期',
      });
      await next();
    },
  validateJson:
    (schema: any) => async (context: any, next: () => Promise<void>) => {
      const rawBody = await context.req.json().catch(() => undefined);
      const parsed = schema.safeParse(rawBody);
      if (!parsed.success) {
        context.res = Response.json(
          { success: false, error: '参数错误' },
          {
            status: 400,
          },
        );
        return;
      }
      context.set('validatedJson', parsed.data);
      await next();
    },
  validateQuery:
    (schema: any) => async (context: any, next: () => Promise<void>) => {
      const parsed = schema.safeParse(context.req.query());
      if (!parsed.success) {
        context.res = Response.json(
          { success: false, error: '参数错误' },
          {
            status: 400,
          },
        );
        return;
      }
      context.set('validatedQuery', parsed.data);
      await next();
    },
}));

vi.mock('@server/lib/repositories/worldChatRepository', () => ({
  createMessage: createMessageMock,
  listLatestMessages: listLatestMessagesMock,
  listMessages: listMessagesMock,
}));

vi.mock('@server/lib/repositories/creationProductRepository', () => ({
  findById: vi.fn(),
}));

vi.mock('@server/lib/redis/worldChatLimiter', () => ({
  checkAndAcquireCooldown: checkAndAcquireCooldownMock,
}));

vi.mock('@server/lib/services/cultivatorService', () => ({
  getCultivatorConsumables: vi.fn(),
  getCultivatorMaterials: vi.fn(),
}));

import worldChatRouter from './world-chat.router';

function createApp() {
  const app = new Hono();
  app.use('*', jsonError());
  app.route('/api/world-chat', worldChatRouter);
  return app;
}

function message(
  id: string,
  channel: WorldChatMessageDTO['channel'],
): WorldChatMessageDTO {
  return {
    id,
    channel,
    senderUserId: 'user-1',
    senderCultivatorId: channel === 'system' ? null : 'cultivator-1',
    senderName: channel === 'system' ? '修仙界传闻' : '林玄',
    senderRealm: 'foundation',
    senderRealmStage: channel === 'system' ? '系统' : '筑基中期',
    messageType: 'text',
    textContent: `${id}-text`,
    payload: { text: `${id}-text` },
    status: 'active',
    createdAt: '2026-05-17T08:00:00.000Z',
  };
}

describe('world chat router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkAndAcquireCooldownMock.mockResolvedValue({ allowed: true });
    createMessageMock.mockImplementation((input) =>
      Promise.resolve({
        id: 'created-1',
        createdAt: '2026-05-17T08:00:00.000Z',
        status: 'active',
        ...input,
      }),
    );
    listMessagesMock.mockResolvedValue({
      messages: [message('world-1', 'world'), message('system-1', 'system')],
      hasMore: false,
    });
    listLatestMessagesMock.mockResolvedValue([message('world-1', 'world')]);
  });

  it('lists all messages by default', async () => {
    const response = await createApp().request('/api/world-chat/messages');

    expect(response.status).toBe(200);
    expect(listMessagesMock).toHaveBeenCalledWith({
      channel: 'all',
      page: 1,
      pageSize: 20,
    });
  });

  it('passes channel filters to the message repository', async () => {
    const systemResponse = await createApp().request(
      '/api/world-chat/messages?channel=system&page=2&pageSize=10',
    );
    const worldResponse = await createApp().request(
      '/api/world-chat/messages?channel=world',
    );

    expect(systemResponse.status).toBe(200);
    expect(worldResponse.status).toBe(200);
    expect(listMessagesMock).toHaveBeenCalledWith({
      channel: 'system',
      page: 2,
      pageSize: 10,
    });
    expect(listMessagesMock).toHaveBeenCalledWith({
      channel: 'world',
      page: 1,
      pageSize: 20,
    });
  });

  it('rejects invalid channel filters', async () => {
    const response = await createApp().request(
      '/api/world-chat/messages?channel=invalid',
    );

    expect(response.status).toBe(400);
    expect(listMessagesMock).not.toHaveBeenCalled();
  });

  it('creates player text messages in the world channel', async () => {
    const response = await createApp().request('/api/world-chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'system',
        messageType: 'text',
        textContent: '诸位道友，今晚子时再会。',
      }),
    });

    expect(response.status).toBe(200);
    expect(createMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'world',
        senderCultivatorId: 'cultivator-1',
        messageType: 'text',
        textContent: '诸位道友，今晚子时再会。',
      }),
    );
  });
});
