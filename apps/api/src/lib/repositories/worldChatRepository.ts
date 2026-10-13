import type { WorldChatChannel } from '@daoyou/contracts/world-chat';
import { db } from '@server/lib/drizzle/db.js';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher.js';
import {
  insertChatMessage,
  listChatMessages,
  type CreateChatMessageInput,
} from './chatRepository.js';

type WorldChatListChannel = 'all' | Exclude<WorldChatChannel, 'sect'>;

export async function createMessage(
  data: Omit<CreateChatMessageInput, 'channel' | 'sectId'> & {
    channel?: 'world' | 'system';
  },
) {
  const committed = await db.transaction((tx) =>
    insertChatMessage(
      { ...data, channel: data.channel ?? 'world', sectId: null },
      tx,
    ),
  );
  publishTransactionalMessageBestEffort(committed.outboxId, {
    context: 'world-chat',
    messageId: committed.message.id,
  });
  return committed.message;
}

export async function listMessages(options: {
  channel: WorldChatListChannel;
  page?: number;
  pageSize: number;
  beforeCursor?: string;
  afterCursor?: string;
  aroundMessageId?: string;
}) {
  return listChatMessages(options);
}

export async function listLatestMessages(
  limit: number,
  channel: WorldChatListChannel = 'world',
) {
  return (await listChatMessages({ channel, pageSize: limit })).messages;
}
