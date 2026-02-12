import { getExecutor } from '@/lib/drizzle/db';
import { mails } from '@/lib/drizzle/schema';
import { Artifact, Consumable, Material } from '@/types/cultivator';
import { eq } from 'drizzle-orm';

export type MailAttachmentType =
  | 'material'
  | 'consumable'
  | 'artifact'
  | 'spirit_stones';

export interface MailAttachment {
  type: MailAttachmentType;
  name: string;
  quantity: number;
  data?: Material | Consumable | Artifact; // For artifact specifics or other details
}

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
  ) {
    // If there are attachments, force type to reward
    const mailType = attachments.length > 0 ? 'reward' : type;

    const q = getExecutor();
    await q.insert(mails).values({
      cultivatorId,
      title,
      content,
      type: mailType,
      attachments,
      isRead: false,
      isClaimed: false,
    });
  }

  /**
   * Send a simple system notification mail
   */
  static async sendSystemMail(
    cultivatorId: string,
    title: string,
    content: string,
  ) {
    await this.sendMail(cultivatorId, title, content, [], 'system');
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
