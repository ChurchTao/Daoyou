'use client';

import { InkBadge, InkButton, InkNotice } from '@/components/ui';
import { InkModal } from '@/components/layout';
import { useInkUI } from '@/components/providers/InkUIProvider';
import { Material } from '@/types/cultivator';
import { useState } from 'react';
import { Mail } from './MailList';

interface MailDetailModalProps {
  mail: Mail | null;
  onClose: () => void;
  onUpdate: () => void; // Refresh list after claim/read
}

export function MailDetailModal({
  mail,
  onClose,
  onUpdate,
}: MailDetailModalProps) {
  const [isClaiming, setIsClaiming] = useState(false);
  const { pushToast } = useInkUI();

  if (!mail) return null;

  const hasAttachments = mail.attachments && mail.attachments.length > 0;
  const canClaim = hasAttachments && !mail.isClaimed;

  const handleClaim = async () => {
    try {
      setIsClaiming(true);
      const res = await fetch(`/api/mail/${mail.id}/claim`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Claim failed');

      pushToast({ message: '领取成功！', tone: 'success' });
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Claim failed', error);
      pushToast({ message: '领取失败', tone: 'danger' });
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
      <div className="space-y-4 mt-2">
        <div className="text-sm opacity-60">
          {new Date(mail.createdAt).toLocaleString()}
        </div>

        <div className="whitespace-pre-wrap text-ink leading-relaxed bg-paper p-3 rounded border border-ink/5 min-h-[100px]">
          {mail.content}
        </div>

        {hasAttachments && (
          <div className="space-y-2 pt-2">
            <h4 className="font-bold text-sm text-ink-secondary">
              🎁 附赠物品
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {mail.attachments?.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-paper-2 p-2 rounded flex items-center justify-between text-sm"
                >
                  {item.type === 'spirit_stones' && (
                    <span className="text-ink">{item.name}</span>
                  )}
                  {item.type === 'material' && (
                    <InkBadge tier={(item.data as Material)?.rank} hideTierText>
                      {item.name}
                    </InkBadge>
                  )}
                  <span className="opacity-70">x{item.quantity}</span>
                </div>
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
