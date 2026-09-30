import { InkModal } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkNotice } from '@app/components/ui/InkNotice';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { mailLocationText } from '@shared/contracts/mail';
import { useState } from 'react';
import { MailAttachmentSlot } from './MailAttachmentSlot';
import { Mail } from './MailList';

interface MailDetailModalProps {
  mail: Mail | null;
  onClose: () => void;
  onUpdate: (mailId: string) => void; // Update list after claim
}

export function MailDetailModal({
  mail,
  onClose,
  onUpdate,
}: MailDetailModalProps) {
  const [isClaiming, setIsClaiming] = useState(false);
  const { pushToast } = useInkUI();
  const { mutate } = useResourceMutation();

  if (!mail) return null;

  const hasAttachments = mail.attachments && mail.attachments.length > 0;
  const canClaim = hasAttachments && !mail.isClaimed;

  const handleClaim = async () => {
    try {
      setIsClaiming(true);
      const result = await mutate<{ locations?: string[] }>(
        fetch('/api/cultivator/mail/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mailId: mail.id }),
        }),
      );

      pushToast({
        message: `领取成功${result.locations?.length ? ' · ' + mailLocationText(result.locations) : ''}`,
        tone: 'success',
      });
      onUpdate(mail.id);
      onClose();
    } catch (error) {
      console.error('Claim failed', error);
      pushToast({
        message: error instanceof Error ? error.message : '领取失败',
        tone: 'danger',
      });
    } finally {
      setIsClaiming(false);
    }
  };

  // Auto mark read if not read?
  // Maybe handled by parent or useEffect, but typically opening it marks it read.
  // For now let's manually do it via API on mount? Or simpler: do it effectively on close or just assume parent handles it.
  // Implementation Plan said: "POST: Mark mail as read."

  return (
    <InkModal isOpen={!!mail} onClose={onClose} title={mail.title}>
      <div className="mt-2 space-y-4">
        <div className="text-sm opacity-60">
          {new Date(mail.createdAt).toLocaleString()}
        </div>

        <div className="text-ink bg-paper border-ink/10 min-h-[100px] border border-dashed p-3 leading-relaxed whitespace-pre-wrap">
          {mail.content}
        </div>

        {hasAttachments && (
          <div className="space-y-2 pt-2">
            <h4 className="text-ink-secondary text-sm font-bold">
              🎁 附赠物品
            </h4>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {mail.attachments?.map((item, idx) => (
                <MailAttachmentSlot key={idx} attachment={item} />
              ))}
            </div>
          </div>
        )}

        {mail.isClaimed && (
          <InkNotice tone="info" className="py-2 text-center text-sm">
            已领取
          </InkNotice>
        )}

        <div className="flex justify-end gap-2 pt-4">
          {canClaim ? (
            <InkButton
              variant="primary"
              onClick={handleClaim}
              disabled={isClaiming}
            >
              {isClaiming ? '收取中...' : '🎁 收下心意'}
            </InkButton>
          ) : (
            <InkButton onClick={onClose}>阅毕</InkButton>
          )}
        </div>
      </div>
    </InkModal>
  );
}
