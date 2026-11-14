import type { MailAttachment } from '@daoyou/game-domain/mail';

export interface Mail {
  id: string;
  title: string;
  content: string;
  type: 'system' | 'reward';
  attachments: MailAttachment[] | null;
  isRead: boolean;
  isClaimed: boolean;
  createdAt: string;
}
