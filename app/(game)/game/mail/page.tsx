'use client';

import { InkPageShell, InkSection } from '@/components/layout';
import { useInkUI } from '@/components/providers/InkUIProvider';
import { MailDetailModal } from '@/components/mail/MailDetailModal';
import { Mail, MailList } from '@/components/mail/MailList';
import { InkButton } from '@/components/ui/InkButton';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import { useCallback, useEffect, useState } from 'react';

const PAGE_SIZE = 20;

export default function MailPage() {
  const [mails, setMails] = useState<Mail[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedMail, setSelectedMail] = useState<Mail | null>(null);
  const [batchClaiming, setBatchClaiming] = useState(false);
  const [batchReading, setBatchReading] = useState(false);
  const { refreshInventory } = useCultivator();
  const { pushToast } = useInkUI();

  const fetchMails = useCallback(async (targetPage: number, append: boolean) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      const res = await fetch(
        `/api/cultivator/mail?page=${targetPage}&pageSize=${PAGE_SIZE}`,
      );
      const data = await res.json();
      if (res.ok) {
        const nextMails = (data.mails || []) as Mail[];
        setMails((prev) => (append ? [...prev, ...nextMails] : nextMails));
        setHasMore(Boolean(data.pagination?.hasMore));
        setPage(targetPage);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchMails(1, false);
  }, [fetchMails]);

  const handleSelectMail = async (mail: Mail) => {
    setSelectedMail(mail);

    // Mark as read if not already
    if (!mail.isRead) {
      try {
        await fetch('/api/cultivator/mail/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mailId: mail.id }),
        });
        // Optimistic update locally
        setMails((prev) =>
          prev.map((m) => (m.id === mail.id ? { ...m, isRead: true } : m)),
        );
      } catch (e) {
        console.error('Failed to mark read', e);
      }
    }
  };

  const handleLoadMore = () => {
    if (!hasMore || loadingMore) return;
    fetchMails(page + 1, true);
  };

  const handleUpdate = (mailId: string) => {
    // 领取后就地更新，避免重新拉取已加载页
    setMails((prev) =>
      prev.map((mail) =>
        mail.id === mailId ? { ...mail, isClaimed: true, isRead: true } : mail,
      ),
    );
    setSelectedMail((prev) =>
      prev && prev.id === mailId ? { ...prev, isClaimed: true, isRead: true } : prev,
    );
    refreshInventory();
  };

  const handleClaimAll = async () => {
    try {
      setBatchClaiming(true);
      const res = await fetch('/api/cultivator/mail/claim-all', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '一键领取失败');
      }

      const claimedMailIds = (data.claimedMailIds || []) as string[];
      if (claimedMailIds.length > 0) {
        setMails((prev) =>
          prev.map((mail) =>
            claimedMailIds.includes(mail.id)
              ? { ...mail, isClaimed: true, isRead: true }
              : mail,
          ),
        );
        setSelectedMail((prev) =>
          prev && claimedMailIds.includes(prev.id)
            ? { ...prev, isClaimed: true, isRead: true }
            : prev,
        );
        await refreshInventory();
      }

      pushToast({
        message:
          claimedMailIds.length > 0
            ? `成功领取 ${claimedMailIds.length} 封邮件附件`
            : '暂无可领取附件',
        tone: 'success',
      });
    } catch (error) {
      console.error('Claim all failed', error);
      pushToast({ message: '一键领取失败', tone: 'danger' });
    } finally {
      setBatchClaiming(false);
    }
  };

  const handleReadAll = async () => {
    try {
      setBatchReading(true);
      const res = await fetch('/api/cultivator/mail/read-all', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '全部已读失败');
      }

      const updatedCount = Number(data.updatedCount || 0);
      setMails((prev) => prev.map((mail) => ({ ...mail, isRead: true })));
      setSelectedMail((prev) => (prev ? { ...prev, isRead: true } : prev));

      pushToast({
        message: updatedCount > 0 ? `已标记 ${updatedCount} 封为已读` : '没有未读邮件',
        tone: 'success',
      });
    } catch (error) {
      console.error('Read all failed', error);
      pushToast({ message: '全部已读失败', tone: 'danger' });
    } finally {
      setBatchReading(false);
    }
  };

  return (
    <InkPageShell
      title="传音玉简"
      subtitle="鸿雁长飞光不度，鱼龙潜跃水成文"
      backHref="/game"
    >
      <InkSection title="【收件箱】">
        {loading ? (
          <div className="py-8 text-center text-sm opacity-50">
            正在接收灵讯...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap justify-end gap-2">
              <InkButton
                onClick={handleClaimAll}
                disabled={batchClaiming || batchReading || mails.length === 0}
              >
                {batchClaiming ? '领取中...' : '一键领取'}
              </InkButton>
              <InkButton
                onClick={handleReadAll}
                disabled={batchReading || batchClaiming || mails.length === 0}
              >
                {batchReading ? '处理中...' : '全部已读'}
              </InkButton>
            </div>
            <MailList mails={mails} onSelect={handleSelectMail} />
            {hasMore && (
              <div className="flex justify-center pt-2">
                <InkButton onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore ? '接收中...' : '加载更多'}
                </InkButton>
              </div>
            )}
          </div>
        )}
      </InkSection>

      <MailDetailModal
        mail={selectedMail}
        onClose={() => setSelectedMail(null)}
        onUpdate={handleUpdate}
      />
    </InkPageShell>
  );
}
