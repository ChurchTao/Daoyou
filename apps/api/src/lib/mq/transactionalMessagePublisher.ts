import { getJetStreamClient } from '@server/lib/nats/index.js';
import {
  findPendingTransactionalMessage,
  markTransactionalMessagePublished,
  recordTransactionalMessagePublishAttempt,
  recordTransactionalMessagePublishFailure,
} from '@server/lib/repositories/transactionalMessageRepository.js';
import { JSONCodec } from 'nats';

const codec = JSONCodec();

export async function publishTransactionalMessage(
  messageId: string,
): Promise<void> {
  const row = await findPendingTransactionalMessage(messageId);
  if (!row) return;

  await recordTransactionalMessagePublishAttempt(row.id);
  try {
    const jetStream = await getJetStreamClient();
    await jetStream.publish(row.destination, codec.encode(row.payload), {
      msgID: row.id,
      timeout: 5_000,
    });
    await markTransactionalMessagePublished(row.id);
  } catch (error) {
    await recordTransactionalMessagePublishFailure(row.id, error).catch(
      (recordError) => {
        console.error(
          '[transactional-message] failed to record publish error',
          {
            messageId: row.id,
            recordError,
          },
        );
      },
    );
    throw error;
  }
}

export function publishTransactionalMessageBestEffort(
  messageId: string | undefined,
  context: Record<string, unknown>,
): void {
  if (!messageId) return;
  void publishTransactionalMessage(messageId).catch((error) => {
    console.error('[transactional-message] immediate publish failed', {
      messageId,
      ...context,
      error,
    });
  });
}
