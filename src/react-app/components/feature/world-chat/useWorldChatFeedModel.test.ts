import type { WorldChatMessageDTO } from '@shared/types/world-chat';
import { describe, expect, it } from 'vitest';
import {
  countNewWorldChatMessages,
  mergeWorldChatMessages,
} from './useWorldChatFeedModel';
import { getWorldChatMessageBody } from './worldChatSummary';

function createMessage(
  id: string,
  createdAt: string,
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
    textContent: `${id}-message`,
    payload: { text: `${id}-message` },
    status: 'active',
    createdAt,
    ...overrides,
  };
}

describe('world chat feed model helpers', () => {
  it('merges polled messages without duplicates and keeps newest first', () => {
    const base = [
      createMessage('m2', '2026-05-17T08:02:00.000Z'),
      createMessage('m1', '2026-05-17T08:01:00.000Z'),
    ];
    const incoming = [
      createMessage('m3', '2026-05-17T08:03:00.000Z'),
      createMessage('m2', '2026-05-17T08:02:00.000Z', {
        textContent: 'duplicate',
        payload: { text: 'duplicate' },
      }),
    ];

    expect(mergeWorldChatMessages(base, incoming).map((message) => message.id)).toEqual([
      'm3',
      'm2',
      'm1',
    ]);
  });

  it('counts local new messages from the last seen message id', () => {
    const messages = [
      createMessage('m4', '2026-05-17T08:04:00.000Z'),
      createMessage('m3', '2026-05-17T08:03:00.000Z'),
      createMessage('m2', '2026-05-17T08:02:00.000Z'),
      createMessage('m1', '2026-05-17T08:01:00.000Z'),
    ];

    expect(countNewWorldChatMessages(messages, 'm2')).toBe(2);
    expect(countNewWorldChatMessages(messages, 'm4')).toBe(0);
    expect(countNewWorldChatMessages(messages, 'missing')).toBe(0);
  });

  it('builds compact preview bodies for different message types', () => {
    const duelInvite = createMessage('duel', '2026-05-17T08:05:00.000Z', {
      messageType: 'duel_invite',
      textContent: '赌战台已有战帖，速来应战。',
      payload: { routePath: '/game/bet-battle' },
    });
    const showcase = createMessage('showcase', '2026-05-17T08:06:00.000Z', {
      messageType: 'item_showcase',
      textContent: null,
      payload: {
        itemType: 'artifact',
        itemId: 'artifact-1',
        snapshot: {
          id: 'artifact-1',
          name: '玄雷剑胚',
          slot: 'weapon',
          element: '雷',
          quality: 'epic',
          description: '未淬成的剑胚。',
        },
        text: '今日刚出炉。',
      },
    });
    const textMessage = createMessage('text', '2026-05-17T08:07:00.000Z', {
      textContent: null,
      payload: { text: '诸位道友，今晚子时再会。' },
    });

    expect(getWorldChatMessageBody(duelInvite)).toBe('赌战台已有战帖，速来应战。');
    expect(getWorldChatMessageBody(showcase)).toBe('展示了「玄雷剑胚」 今日刚出炉。');
    expect(getWorldChatMessageBody(textMessage)).toBe('诸位道友，今晚子时再会。');
  });
});
