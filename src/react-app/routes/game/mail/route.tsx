import {
  GameSceneAsideSection,
  GameSceneFrame,
} from '@app/components/game-shell';
import { MailDetailModal } from '@app/components/mail/MailDetailModal';
import { Mail, MailList } from '@app/components/mail/MailList';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { usePlayerStateActions } from '@app/lib/player-state/store';
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
  const { mutate } = usePlayerStateActions();
  const { pushToast } = useInkUI();

  const fetchMails = useCallback(
    async (targetPage: number, append: boolean) => {
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
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const loadInitialMails = async () => {
      try {
        const res = await fetch(
          `/api/cultivator/mail?page=1&pageSize=${PAGE_SIZE}`,
        );
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          const nextMails = (data.mails || []) as Mail[];
          setMails(nextMails);
          setHasMore(Boolean(data.pagination?.hasMore));
          setPage(1);
        }
      } catch (e) {
        if (!cancelled) {
          console.error(e);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadInitialMails();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectMail = async (mail: Mail) => {
    setSelectedMail(mail);

    // Mark as read if not already
    if (!mail.isRead) {
      try {
        await mutate(
          fetch('/api/cultivator/mail/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mailId: mail.id }),
          }),
        );
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
      prev && prev.id === mailId
        ? { ...prev, isClaimed: true, isRead: true }
        : prev,
    );
  };

  const handleClaimAll = async () => {
    try {
      setBatchClaiming(true);
      const data = await mutate<{
        claimedCount: number;
        claimedMailIds: string[];
        unreadMailCount: number;
      }>(
        fetch('/api/cultivator/mail/claim-all', {
          method: 'POST',
        }),
      );

      const claimedMailIds = data.claimedMailIds || [];
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
      const data = await mutate<{
        updatedCount: number;
        unreadMailCount: number;
      }>(
        fetch('/api/cultivator/mail/read-all', {
          method: 'POST',
        }),
      );

      const updatedCount = Number(data.updatedCount || 0);
      setMails((prev) => prev.map((mail) => ({ ...mail, isRead: true })));
      setSelectedMail((prev) => (prev ? { ...prev, isRead: true } : prev));

      pushToast({
        message:
          updatedCount > 0 ? `已标记 ${updatedCount} 封为已读` : '没有未读邮件',
        tone: 'success',
      });
    } catch (error) {
      console.error('Read all failed', error);
      pushToast({ message: '全部已读失败', tone: 'danger' });
    } finally {
      setBatchReading(false);
    }
  };

  const unreadCount = mails.filter((mail) => !mail.isRead).length;
  const pendingAttachments = mails.filter(
    (mail) => mail.type === 'reward' && !mail.isClaimed,
  ).length;

  return (
    <GameSceneFrame
      title="【传音玉简】"
      description="宗门告示、奖励来函与四方灵讯都在此归卷。先清掉要紧的未读与附件，再决定今日是否继续外出。"
      aside={
        <>
          <GameSceneAsideSection title="收件摘要">
            <div className="space-y-2 text-sm leading-7">
              <p>当前已载：{mails.length} 封</p>
              <p>未读：{unreadCount} 封</p>
              <p>待领附件：{pendingAttachments} 封</p>
            </div>
          </GameSceneAsideSection>
          <GameSceneAsideSection
            title="操作说明"
            className="text-sm leading-7"
            help={{
              title: '传音玉简操作说明',
              content: (
                <div className="space-y-2 text-sm leading-7">
                  <p>点击玉简可展开全文，未读会即时回写。</p>
                  <p>奖励类来函支持就地领取，不必离开当前场景。</p>
                </div>
              ),
            }}
          />
        </>
      }
    >
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
        {loading ? (
          <div className="py-8 text-center text-sm opacity-50">
            正在接收灵讯...
          </div>
        ) : (
          <div className="space-y-4">
            <MailList mails={mails} onSelect={handleSelectMail} />
            {hasMore ? (
              <div className="flex justify-center pt-2">
                <InkButton onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore ? '接收中...' : '加载更多'}
                </InkButton>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <MailDetailModal
        mail={selectedMail}
        onClose={() => setSelectedMail(null)}
        onUpdate={handleUpdate}
      />
    </GameSceneFrame>
  );
}
