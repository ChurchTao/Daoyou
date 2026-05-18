import type { WorldChatMessageDTO } from '@shared/types/world-chat';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorldChatPreviewBar } from './WorldChatPreviewBar';
import { useWorldChatFeedModel } from './useWorldChatFeedModel';

vi.mock('./useWorldChatFeedModel', () => ({
  useWorldChatFeedModel: vi.fn(),
}));

function createMessage(
  id: string,
  text: string,
  overrides: Partial<WorldChatMessageDTO> = {},
): WorldChatMessageDTO {
  return {
    id,
    channel: 'world',
    senderUserId: 'user-1',
    senderCultivatorId: 'cultivator-1',
    senderName: '林玄',
    senderRealm: 'foundation',
    senderRealmStage: '筑基中期',
    messageType: 'text',
    textContent: text,
    payload: { text },
    status: 'active',
    createdAt: '2026-05-18T08:00:00.000Z',
    ...overrides,
  };
}

function buildFeedModel(overrides: Partial<ReturnType<typeof useWorldChatFeedModel>> = {}) {
  return {
    messages: [],
    latestMessage: createMessage('m1', '诸位道友，今晚子时再会。'),
    newMessageCount: 2,
    loading: false,
    loadingMore: false,
    hasMore: false,
    posting: false,
    isWorldChatRoute: false,
    loadMore: vi.fn(async () => {}),
    sendTextMessage: vi.fn(async () => true),
    sendShowcaseMessage: vi.fn(async () => true),
    ...overrides,
  };
}

const mockedUseWorldChatFeedModel = vi.mocked(useWorldChatFeedModel);

describe('WorldChatPreviewBar', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows a one-line preview that links to the world chat scene', () => {
    mockedUseWorldChatFeedModel.mockReturnValue(buildFeedModel());

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <WorldChatPreviewBar />
      </MemoryRouter>,
    );

    expect(html).toContain('href="/game/world-chat"');
    expect(html).toContain('林玄');
    expect(html).toContain('诸位道友，今晚子时再会。');
    expect(html).toContain('[查看]');
  });

  it('renders nothing while already on the world chat scene page', () => {
    mockedUseWorldChatFeedModel.mockReturnValue(
      buildFeedModel({ isWorldChatRoute: true }),
    );

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <WorldChatPreviewBar />
      </MemoryRouter>,
    );

    expect(html).toBe('');
  });
});
