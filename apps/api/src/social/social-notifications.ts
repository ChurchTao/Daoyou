import type { SocialChangedPayload } from '@daoyou/contracts/realtime';
import type { DbTransaction } from '@server/lib/drizzle/db.js';
import { createTransactionalMessage } from '@server/lib/repositories/transactionalMessageRepository.js';
import {
  encodeNatsSubjectToken,
  subscribeNatsCoreSubject,
} from '@server/realtime/infrastructure/natsCorePubSub.js';

export type { SocialChangedPayload } from '@daoyou/contracts/realtime';

export function socialNotificationSubject(userId: string) {
  return `daoyou.realtime.social.user.${encodeNatsSubjectToken(userId)}`;
}

export async function enqueueSocialNotification(
  tx: DbTransaction,
  userId: string,
  payload: SocialChangedPayload,
): Promise<void> {
  await createTransactionalMessage(
    {
      messageKey: 'social.notification',
      destination: socialNotificationSubject(userId),
      payload,
    },
    tx,
  );
}

export function subscribeSocialNotifications(
  userId: string,
  listener: (payload: SocialChangedPayload) => void,
): () => void {
  return subscribeNatsCoreSubject(socialNotificationSubject(userId), (raw) => {
    try {
      const payload: unknown = JSON.parse(raw);
      if (!payload || typeof payload !== 'object') return;
      const value = payload as Partial<SocialChangedPayload>;
      if (value.cultivatorId !== null && typeof value.cultivatorId !== 'string')
        return;
      if (!['friends', 'direct-chat', 'mentorship', 'achievements'].includes(value.kind ?? ''))
        return;
      if (
        value.conversationId !== undefined &&
        typeof value.conversationId !== 'string'
      )
        return;
      if (
        value.sequence !== undefined &&
        (!Number.isSafeInteger(value.sequence) || value.sequence < 0)
      )
        return;
      listener(value as SocialChangedPayload);
    } catch {
      // Ignore malformed cross-instance notifications; the HTTP feed is authoritative.
    }
  });
}
