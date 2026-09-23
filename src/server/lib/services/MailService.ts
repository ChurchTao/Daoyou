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
      const event = await createMailNotification(
        q,
        mail.id,
        cultivatorId,
        mailType,
        attachments.length,
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

  static async sendCampaignRewardMail(
    input: {
      campaignId: string;
      cultivatorId: string;
      title: string;
      content: string;
      attachments: MailAttachment[];
    },
    tx: DbTransaction,
  ): Promise<boolean> {
    const attachments = input.attachments.map(newRewardAttachment);
    const type = attachments.length ? 'reward' : 'system';
    const [mail] = await tx
      .insert(mails)
      .values({
        systemMailCampaignId: input.campaignId,
        cultivatorId: input.cultivatorId,
        title: input.title,
        content: input.content,
        attachments,
        type,
      })
      .onConflictDoNothing({
        target: [mails.systemMailCampaignId, mails.cultivatorId],
      })
      .returning({ id: mails.id });
    if (!mail) return false;
    await createMailNotification(
      tx,
      mail.id,
      input.cultivatorId,
      type,
      attachments.length,
    );
    return true;
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

async function createMailNotification(
  tx: DbTransaction,
  mailId: string,
  cultivatorId: string,
  mailType: 'system' | 'reward',
  attachmentCount: number,
) {
  return createDomainEvent(
    {
      type: 'mail.created',
      aggregate: { type: 'mail', id: mailId },
      data: { mailId, cultivatorId, mailType, attachmentCount },
      deduplicationKey: mailId,
    },
    tx,
  );
}
