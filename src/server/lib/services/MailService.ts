import { db, getExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import { mails } from '@server/lib/drizzle/schema';
import { createDomainEvent } from '@server/lib/mq/domainEventWriter';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher';
import type { MailAttachment } from '@shared/types/mail';
import { eq } from 'drizzle-orm';
import { newRewardAttachment } from './MailInventory';

export type { MailAttachment, MailAttachmentType } from '@shared/types/mail';

export class MailService {
  static async sendNewRewardMail(
    ...args: Parameters<typeof MailService.sendMail>
  ) {
    args[3] = (args[3] ?? []).map(newRewardAttachment);
    return MailService.sendMail(...args);
  }

  /**
   * Send a mail to a cultivator
   */
  static async sendMail(
    cultivatorId: string,
    title: string,
    content: string,
    attachments: MailAttachment[] = [],
    type: 'system' | 'reward' = 'system',
    tx?: DbTransaction,
  ) {
    // If there are attachments, force type to reward
    const mailType = attachments.length > 0 ? 'reward' : type;

    const persist = async (q: DbTransaction) => {
      const [mail] = await q
        .insert(mails)
        .values({
          cultivatorId,
          title,
          content,
          type: mailType,
          attachments,
          isRead: false,
          isClaimed: false,
        })
        .returning({ id: mails.id });
      if (!mail) throw new Error('邮件创建失败');
      const event = await createDomainEvent(
        {
          type: 'mail.created',
          aggregate: { type: 'mail', id: mail.id },
          data: {
            mailId: mail.id,
            cultivatorId,
            mailType,
            attachmentCount: attachments.length,
          },
          deduplicationKey: mail.id,
        },
        q,
      );
      return { ...mail, domainEventId: event.id };
    };

    if (tx) return persist(tx);
    const mail = await db.transaction(persist);
    publishTransactionalMessageBestEffort(mail.domainEventId, {
      source: 'mail_created',
      cultivatorId,
      mailId: mail.id,
    });
    return mail;
  }

  /**
   * Send a simple system notification mail
   */
  static async sendSystemMail(
    cultivatorId: string,
    title: string,
    content: string,
    tx?: DbTransaction,
  ) {
    return this.sendMail(cultivatorId, title, content, [], 'system', tx);
  }

  /**
   * Get mails for a cultivator
   */
  static async getMails(cultivatorId: string) {
    const q = getExecutor();
    return await q.query.mails.findMany({
      where: eq(mails.cultivatorId, cultivatorId),
      orderBy: (mails, { desc }) => [desc(mails.createdAt)],
    });
  }
}
