import { useSocialQuery } from '@app/components/feature/friends/socialApi';
import { GameLoadingState, GameSceneFrame } from '@app/components/game-shell';
import { MailComposer } from '@app/components/mail/MailComposer';
import { MailDetailModal } from '@app/components/mail/MailDetailModal';
import { type Mail, MailList } from '@app/components/mail/MailList';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkNotice } from '@app/components/ui';
import { apiFetch } from '@app/lib/api/fetch';
import { useAuth } from '@app/lib/auth/useAuth';
import { pendingCommandRequest } from '@app/lib/pendingCommandRequest';
import { realtimeClient } from '@app/lib/realtime/realtimeClient';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { usePlayerSession } from '@app/lib/resources/player';
import type { FriendCultivatorSummary } from '@daoyou/contracts/friends';
import { mailLocationText } from '@daoyou/game-rules/mail';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';

const PAGE_SIZE = 20;
export default function MailPage() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const actorId = usePlayerSession().data?.activeCultivator?.id;
  if (params.get('tab') === 'friends' || params.has('addFriend')) {
    const next = new URLSearchParams({ tab: 'friends' });
    if (params.get('addFriend'))
      next.set('addFriend', params.get('addFriend')!);
    return <Navigate replace to={`/game/friends?${next}`} />;
  }
  return (
    <MailInbox
      key={`${user?.id}:${actorId}:${params.get('composeTo') ?? 'inbox'}`}
    />
  );
}

function MailInbox() {
  const cultivator = usePlayerSession().data?.activeCultivator;
  const [params, setParams] = useSearchParams();
  const composeTo = params.get('composeTo');
  const conversation = params.get('conversation');
  const friends = useSocialQuery<{ friends: FriendCultivatorSummary[] }>(
    '/api/friends',
  );
  const [recipientId, setRecipientId] = useState(composeTo ?? '');
  const [showSendModal, setShowSendModal] = useState(Boolean(composeTo));
  const [mails, setMails] = useState<Mail[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedMail, setSelectedMail] = useState<Mail | null>(null);
  const [batchClaiming, setBatchClaiming] = useState(false);
  const [batchReading, setBatchReading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const mailRequest = useRef<AbortController | null>(null);
  const { mutate } = useResourceMutation();
  const { pushToast } = useInkUI();
  const requestedRecipientAvailable =
    !composeTo ||
    friends.data?.friends.some((friend) => friend.id === composeTo);

  const fetchMails = useCallback(
    async (targetPage: number, append: boolean) => {
      mailRequest.current?.abort();
      const controller = new AbortController();
      mailRequest.current = controller;
      try {
        const response = await apiFetch(
          `/api/cultivator/mail?page=${targetPage}&pageSize=${PAGE_SIZE}`,
          { signal: controller.signal },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '传音读取失败');
        if (controller.signal.aborted) return;
        const next = (data.mails || []) as Mail[];
        setMails((previous) => (append ? [...previous, ...next] : next));
        setHasMore(Boolean(data.pagination?.hasMore));
        setPage(targetPage);
        setLoadError('');
      } catch (error) {
        if (!controller.signal.aborted)
          setLoadError(error instanceof Error ? error.message : '传音读取失败');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [],
  );
  useEffect(() => {
    const controller = new AbortController();
    mailRequest.current = controller;
    apiFetch(`/api/cultivator/mail?page=1&pageSize=${PAGE_SIZE}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '传音读取失败');
        if (!controller.signal.aborted) {
          setMails((data.mails ?? []) as Mail[]);
          setHasMore(Boolean(data.pagination?.hasMore));
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setLoadError(error instanceof Error ? error.message : '传音读取失败');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    const off = realtimeClient.subscribe(
      'player-state.events',
      ({ payload }) => {
        if (
          payload.changes.some(
            (change) =>
              change.resourceTopic === 'player.mail-summary' &&
              change.eventType === 'mail.created',
          )
        )
          void fetchMails(1, false);
      },
    );
    const offReady = realtimeClient.subscribe('ready', () => {
      void fetchMails(1, false);
    });
    return () => {
      mailRequest.current?.abort();
      off();
      offReady();
    };
  }, [fetchMails]);

  async function selectMail(mail: Mail) {
    setSelectedMail(mail);
    if (mail.isRead) return;
    try {
      await mutate(
        apiFetch('/api/cultivator/mail/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mailId: mail.id }),
        }),
      );
      setMails((previous) =>
        previous.map((item) =>
          item.id === mail.id ? { ...item, isRead: true } : item,
        ),
      );
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '标记已读失败',
        tone: 'warning',
      });
    }
  }
  function updateMail(mailId: string) {
    setMails((previous) =>
      previous.map((mail) =>
        mail.id === mailId ? { ...mail, isClaimed: true, isRead: true } : mail,
      ),
    );
    setSelectedMail((previous) =>
      previous?.id === mailId
        ? { ...previous, isClaimed: true, isRead: true }
        : previous,
    );
  }
  async function claimAll() {
    if (!cultivator || batchClaiming || batchReading) return;
    const pending = pendingCommandRequest(cultivator.id, 'mail-claim-all');
    setBatchClaiming(true);
    try {
      const data = await mutate<{
        locations?: string[];
        skipped?: { id: string; reason: 'capacity' | 'occupied' }[];
        claimedMailIds: string[];
      }>(
        apiFetch('/api/cultivator/mail/claim-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId: pending.requestId }),
        }),
      );
      pending.complete();
      const ids = new Set(data.claimedMailIds ?? []);
      setMails((previous) =>
        previous.map((mail) =>
          ids.has(mail.id) ? { ...mail, isClaimed: true, isRead: true } : mail,
        ),
      );
      setSelectedMail((previous) =>
        previous && ids.has(previous.id)
          ? { ...previous, isClaimed: true, isRead: true }
          : previous,
      );
      const skipped = data.skipped ?? [];
      const waiting = skipped.length
        ? `；${skipped.length} 封灵兽邮件待${skipped.some((item) => item.reason === 'occupied') ? '战斗结束' : '腾出仓位'}后领取`
        : '';
      pushToast({
        message:
          (ids.size
            ? `成功领取 ${ids.size} 封邮件附件${data.locations?.length ? ` · ${mailLocationText(data.locations)}` : ''}`
            : '暂无可领取附件') + waiting,
        tone: skipped.length ? 'warning' : 'success',
      });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '一键领取失败',
        tone: 'danger',
      });
    } finally {
      setBatchClaiming(false);
    }
  }
  async function readAll() {
    if (batchReading || batchClaiming) return;
    setBatchReading(true);
    try {
      await mutate(
        apiFetch('/api/cultivator/mail/read-all', { method: 'POST' }),
      );
      setMails((previous) =>
        previous.map((mail) => ({ ...mail, isRead: true })),
      );
      setSelectedMail((previous) =>
        previous ? { ...previous, isRead: true } : previous,
      );
      pushToast({ message: '已标记全部传音为已读', tone: 'success' });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '标记已读失败',
        tone: 'danger',
      });
    } finally {
      setBatchReading(false);
    }
  }
  function closeComposer() {
    setShowSendModal(false);
    if (composeTo)
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.delete('composeTo');
          return next;
        },
        { replace: true },
      );
  }

  return (
    <GameSceneFrame description="阅读往来玉简、领取附件，也可向好友投递随身物品。">
      <div className="flex flex-wrap justify-end gap-2">
        {conversation ? (
          <InkButton
            href={`/game/friends?chat=${encodeURIComponent(conversation)}`}
            variant="secondary"
          >
            返回私聊
          </InkButton>
        ) : null}
        <InkButton
          variant="primary"
          disabled={!friends.data?.friends.length}
          onClick={() => setShowSendModal(true)}
        >
          发送传音
        </InkButton>
        <InkButton
          pending={batchClaiming}
          disabled={batchReading || !mails.length}
          onClick={() => void claimAll()}
        >
          一键领取
        </InkButton>
        <InkButton
          pending={batchReading}
          disabled={batchClaiming || !mails.length}
          onClick={() => void readAll()}
        >
          全部已读
        </InkButton>
      </div>
      {friends.error ? (
        <InkNotice tone="warning">收信好友读取失败：{friends.error}</InkNotice>
      ) : null}
      {composeTo && friends.data && !requestedRecipientAvailable ? (
        <div role="alert" className="text-crimson text-sm leading-7">
          当前无法向指定道友发送传音，请先检查好友关系。不会自动改为其他收信人。
          <InkButton
            href={`/game/friends?addFriend=${encodeURIComponent(composeTo)}`}
          >
            查看道友
          </InkButton>
        </div>
      ) : null}
      {loadError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2"
        >
          <InkNotice tone="warning">{loadError}</InkNotice>
          <InkButton onClick={() => void fetchMails(1, false)}>重试</InkButton>
        </div>
      ) : null}
      {loading && !mails.length ? (
        <GameLoadingState message="正在接收传音玉简……" variant="inline" />
      ) : (
        <MailList mails={mails} onSelect={(mail) => void selectMail(mail)} />
      )}
      {hasMore ? (
        <div className="flex justify-center">
          <InkButton
            pending={loadingMore}
            onClick={() => {
              setLoadingMore(true);
              void fetchMails(page + 1, true);
            }}
          >
            加载更多
          </InkButton>
        </div>
      ) : null}
      {!friends.loading && friends.data?.friends.length === 0 ? (
        <p className="text-ink-secondary text-sm">
          暂无可寄信的好友，可前往独立好友名录结缘。
          <InkButton href="/game/friends?tab=friends">前往好友</InkButton>
        </p>
      ) : null}
      {selectedMail ? (
        <MailDetailModal
          mail={selectedMail}
          onClose={() => setSelectedMail(null)}
          onUpdate={updateMail}
        />
      ) : null}
      {showSendModal && friends.data && requestedRecipientAvailable ? (
        <MailComposer
          friends={friends.data.friends}
          recipientId={recipientId}
          onRecipientChange={setRecipientId}
          onClose={closeComposer}
        />
      ) : null}
    </GameSceneFrame>
  );
}
