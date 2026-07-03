import type { WorldChatMessageDTO } from '@shared/types/world-chat';

const { lpushMock, lrangeMock, ltrimMock } = vi.hoisted(() => ({
  lpushMock: vi.fn(),
  lrangeMock: vi.fn(),
  ltrimMock: vi.fn(),
}));

vi.mock('@server/lib/redis', () => ({
  redis: {
    lpush: lpushMock,
    lrange: lrangeMock,
    ltrim: ltrimMock,
  },
}));

import {
  createMessage,
  listLatestMessages,
  listMessages,
} from './worldChatRepository';

function storedMessage(
  id: string,
  overrides: Partial<WorldChatMessageDTO> = {},
) {
  return JSON.stringify({
    id,
    channel: 'world',
    senderUserId: 'user-1',
    senderCultivatorId: 'cultivator-1',
    senderName: '林玄',
    senderRealm: 'foundation',
    senderRealmStage: '筑基中期',
    messageType: 'text',
    textContent: `${id}-text`,
    payload: { text: `${id}-text` },
    status: 'active',
    createdAt: '2026-05-17T08:00:00.000Z',
    ...overrides,
  });
}

describe('worldChatRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lpushMock.mockResolvedValue(1);
    ltrimMock.mockResolvedValue('OK');
  });

  it('stores player messages in the world channel by default', async () => {
    const created = await createMessage({
      senderUserId: 'user-1',
      senderCultivatorId: 'cultivator-1',
      senderName: '林玄',
      senderRealm: 'foundation',
      senderRealmStage: '筑基中期',
      messageType: 'text',
      textContent: '诸位道友，今晚子时再会。',
      payload: { text: '诸位道友，今晚子时再会。' },
    });

    expect(created.channel).toBe('world');
    expect(lpushMock).toHaveBeenCalledWith(
      'world_chat:messages',
      expect.stringContaining('"channel":"world"'),
    );
  });

  it('filters paginated messages by channel and keeps all as mixed feed', async () => {
    lrangeMock.mockResolvedValue([
      storedMessage('system-1', {
        channel: 'system',
        senderCultivatorId: null,
        senderName: '修仙界传闻',
      }),
      storedMessage('world-1'),
      storedMessage('system-2', {
        channel: 'system',
        senderCultivatorId: null,
        senderName: '修仙界传闻',
      }),
    ]);

    await expect(
      listMessages({ channel: 'all', page: 1, pageSize: 20 }),
    ).resolves.toMatchObject({
      messages: [
        { id: 'system-1', channel: 'system' },
        { id: 'world-1', channel: 'world' },
        { id: 'system-2', channel: 'system' },
      ],
      hasMore: false,
    });
    await expect(
      listMessages({ channel: 'system', page: 1, pageSize: 20 }),
    ).resolves.toMatchObject({
      messages: [
        { id: 'system-1', channel: 'system' },
        { id: 'system-2', channel: 'system' },
      ],
      hasMore: false,
    });
    await expect(
      listMessages({ channel: 'world', page: 1, pageSize: 20 }),
    ).resolves.toMatchObject({
      messages: [{ id: 'world-1', channel: 'world' }],
      hasMore: false,
    });
  });

  it('classifies legacy system rumors even when they were stored as world', async () => {
    lrangeMock.mockResolvedValue([
      storedMessage('legacy-system', {
        channel: 'world',
        senderCultivatorId: null,
        senderName: '修仙界传闻',
      }),
      storedMessage('legacy-world', { channel: undefined }),
    ]);

    await expect(listLatestMessages(10, 'all')).resolves.toMatchObject([
      { id: 'legacy-system', channel: 'system' },
      { id: 'legacy-world', channel: 'world' },
    ]);
  });
});
