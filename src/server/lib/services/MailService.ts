import { getExecutor } from '@server/lib/drizzle/db';
import { mails } from '@server/lib/drizzle/schema';
import type { MailAttachment } from '@shared/types/mail';
import { eq } from 'drizzle-orm';
import type { DbTransaction } from '../drizzle/db';

export type { MailAttachment, MailAttachmentType } from '@shared/types/mail';

export class MailService {
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

    const q = getExecutor(tx);
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
    await this.sendMail(cultivatorId, title, content, [], 'system', tx);
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
