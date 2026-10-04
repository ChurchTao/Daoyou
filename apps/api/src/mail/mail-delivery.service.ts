import type { MailAttachment } from '@daoyou/game-domain/mail';
import { Injectable } from '@nestjs/common';
import type { DbTransaction } from '@server/lib/drizzle/db.js';
import { sendMailInTransaction } from './application/MailService.js';

/** Delivery joins the caller's transaction, including its notification outbox. */
@Injectable()
export class MailDeliveryService {
  send(
    cultivatorId: string,
    title: string,
    content: string,
    attachments: MailAttachment[],
    type: 'system' | 'reward',
    tx: DbTransaction,
  ) {
    return sendMailInTransaction(
      cultivatorId,
      title,
      content,
      attachments,
      type,
      tx,
    );
  }
}
