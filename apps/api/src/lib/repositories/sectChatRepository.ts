import { db } from '@server/lib/drizzle/db.js';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher.js';
import {
  insertChatMessage,
  listChatMessages,
  type CreateChatMessageInput,
} from './chatRepository.js';

export async function createSectChatMessage(
  data: CreateChatMessageInput & { channel: 'sect'; sectId: string },
) {
  const committed = await db.transaction((tx) => insertChatMessage(data, tx));
  publishTransactionalMessageBestEffort(committed.outboxId, {
    context: 'sect-chat',
    messageId: committed.message.id,
  });
  return committed.message;
}

export async function listSectChatMessages(options: {
  sectId: string;
  page?: number;
  pageSize: number;
  beforeCursor?: string;
  afterCursor?: string;
  aroundMessageId?: string;
}) {
  return listChatMessages({ ...options, channel: 'sect' });
}
