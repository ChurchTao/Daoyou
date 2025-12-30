'use client';

import { InkListItem, InkNotice } from '@/components/ui';
import { MailAttachment } from '@/lib/services/MailService';

// Define local interface to match API response/schema
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

interface MailListProps {
  mails: Mail[];
  onSelect: (mail: Mail) => void;
}

export function MailList({ mails, onSelect }: MailListProps) {
  if (!mails || mails.length === 0) {
    return (
      <InkNotice tone="muted">
        <div className="text-center py-8 opacity-60">暂无传音符诏</div>
      </InkNotice>
    );
  }

  return (
    <div className="space-y-1">
      {mails.map((mail) => (
        <div
          key={mail.id}
          onClick={() => onSelect(mail)}
          className={`
                cursor-pointer transition-colors rounded-lg overflow-hidden
                ${mail.isRead ? 'opacity-80' : 'bg-paper-2'}
                hover:bg-ink/5
            `}
        >
          <InkListItem
            title={
              <div className="flex items-center gap-2">
                {mail.type === 'reward' && !mail.isClaimed && (
                  <span className="text-lg">🎁</span>
                )}
                {mail.type === 'reward' && mail.isClaimed && (
                  <span className="opacity-50">[已领取]</span>
                )}
                {mail.type === 'system' && <span className="text-lg">📢</span>}
                {!mail.isRead && (
                  <span className="w-2 h-2 rounded-full bg-crimson inline-block" />
                )}

                <span
                  className={`font-medium ${!mail.isRead ? 'text-ink' : 'text-ink/70'}`}
                >
                  {mail.title}
                </span>
              </div>
            }
            meta={
              <span className="text-xs opacity-50">
                {new Date(mail.createdAt).toLocaleDateString()}
              </span>
            }
            description={
              <div className="text-sm opacity-60 line-clamp-1">
                {mail.content}
              </div>
            }
          />
        </div>
      ))}
    </div>
  );
}
