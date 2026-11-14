import { WorldChatMessageItem } from '@app/components/feature/world-chat/WorldChatMessageItem';
import { mergeWorldChatMessages } from '@app/components/feature/world-chat/worldChatFeedHelpers';
import { InkModal } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { InkSelect } from '@app/components/ui/InkSelect';
import { apiFetch } from '@app/lib/api/fetch';
import type {
  AdminWorldChatMessagesResponse,
  AdminWorldChatMute,
} from '@daoyou/contracts/admin/world-chat';
import type {
  RedPacketSummary,
  WorldChatMessageDTO,
  WorldChatPagination,
} from '@daoyou/contracts/world-chat';
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

type ReadMode = 'latest' | 'before' | 'after' | 'around' | 'sync';
const API = '/api/admin/world-chat';
const WINDOW_SIZE = 150;
const emptyPagination: WorldChatPagination = {
  beforeCursor: null,
  afterCursor: null,
  hasMore: false,
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, { cache: 'no-store', ...init });
  const payload = await response.json();
  if (!response.ok || !payload.success)
    throw new Error(payload.error || '操作失败，请重试');
  return payload as T;
}

function dateLabel(createdAt: string) {
  return new Date(createdAt).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function AdminWorldChatPage() {
  const { pushToast } = useInkUI();
  const [messages, setMessages] = useState<WorldChatMessageDTO[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [mutes, setMutes] = useState<Record<string, AdminWorldChatMute>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [highlight, setHighlight] = useState<string | null>(null);
  const [target, setTarget] = useState<WorldChatMessageDTO | null>(null);
  const [packet, setPacket] = useState<RedPacketSummary | null>(null);
  const [now, setNow] = useState(Date.now);
  const listRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ messages, pagination });
  const busy = useRef(false);
  const mounted = useRef(true);
  const following = useRef(true);
  const pendingPosition = useRef<{
    id?: string;
    offset?: number;
    bottom?: boolean;
  } | null>(null);
  useLayoutEffect(() => {
    stateRef.current = { messages, pagination };
  }, [messages, pagination]);

  const read = useCallback(
    async (mode: ReadMode, messageId?: string, signal?: AbortSignal) => {
      if (busy.current) return;
      const current = stateRef.current;
      const query = new URLSearchParams({ pageSize: '50', channel: 'world' });
      if (mode === 'before' && current.pagination.beforeCursor)
        query.set('beforeCursor', current.pagination.beforeCursor);
      if (
        (mode === 'after' || mode === 'sync') &&
        current.pagination.afterCursor
      )
        query.set('afterCursor', current.pagination.afterCursor);
      if (mode === 'around' && messageId)
        query.set('aroundMessageId', messageId);
      const list = listRef.current;
      const firstVisible = list
        ? Array.from(
            list.querySelectorAll<HTMLElement>('[data-message-id]'),
          ).find(
            (node) =>
              node.getBoundingClientRect().bottom >
              list.getBoundingClientRect().top,
          )
        : undefined;
      const anchor =
        firstVisible && list
          ? {
              id: firstVisible.dataset.messageId,
              offset:
                firstVisible.getBoundingClientRect().top -
                list.getBoundingClientRect().top,
            }
          : null;
      busy.current = true;
      if (mode !== 'sync') setLoading(true);
      try {
        const result = await request<AdminWorldChatMessagesResponse>(
          `${API}/messages?${query}`,
          { signal },
        );
        if (!mounted.current || signal?.aborted) return;
        const replace = mode === 'latest' || mode === 'around';
        const merged = replace
          ? result.data
          : mergeWorldChatMessages(current.messages, result.data);
        const windowed =
          mode === 'before'
            ? merged.slice(-WINDOW_SIZE)
            : merged.slice(0, WINDOW_SIZE);
        const nextPagination = {
          ...result.pagination,
          beforeCursor: windowed.at(-1)?.sequence.toString() ?? null,
          afterCursor: windowed[0]?.sequence.toString() ?? null,
          hasMoreBefore:
            mode === 'before' || replace
              ? Boolean(
                  result.pagination.hasMoreBefore ?? result.pagination.hasMore,
                )
              : Boolean(
                  current.pagination.hasMoreBefore ||
                  merged.length > WINDOW_SIZE,
                ),
          hasMoreAfter:
            mode === 'before'
              ? Boolean(
                  current.pagination.hasMoreAfter ||
                  merged.length > WINDOW_SIZE,
                )
              : Boolean(result.pagination.hasMoreAfter),
        };
        pendingPosition.current =
          mode === 'latest' || (mode === 'sync' && following.current)
            ? { bottom: true }
            : mode === 'around'
              ? { id: messageId, offset: 60 }
              : anchor;
        stateRef.current = { messages: windowed, pagination: nextPagination };
        setMessages(windowed);
        setPagination(nextPagination);
        setMutes((previous) => {
          const next = { ...previous };
          for (const message of result.data) delete next[message.senderUserId];
          return { ...next, ...result.mutes };
        });
        setError('');
        if (mode === 'around' && messageId) setHighlight(messageId);
      } catch (cause) {
        if (mounted.current && !signal?.aborted)
          setError(cause instanceof Error ? cause.message : '聊天记录读取失败');
      } finally {
        busy.current = false;
        if (mounted.current && !signal?.aborted) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    const initial = window.setTimeout(
      () => void read('latest', undefined, controller.signal),
      0,
    );
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (
        document.visibilityState === 'visible' &&
        following.current &&
        !stateRef.current.pagination.hasMoreAfter
      )
        void read('sync', undefined, controller.signal);
    }, 5_000);
    return () => {
      mounted.current = false;
      controller.abort();
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [read]);

  useLayoutEffect(() => {
    const list = listRef.current;
    const position = pendingPosition.current;
    if (!list || !position) return;
    if (position.bottom) list.scrollTop = list.scrollHeight;
    else {
      const row = Array.from(
        list.querySelectorAll<HTMLElement>('[data-message-id]'),
      ).find((node) => node.dataset.messageId === position.id);
      if (row)
        list.scrollTop +=
          row.getBoundingClientRect().top -
          list.getBoundingClientRect().top -
          (position.offset ?? 0);
    }
    pendingPosition.current = null;
  }, [messages]);

  useEffect(() => {
    if (!highlight) return;
    const timer = window.setTimeout(() => setHighlight(null), 2_000);
    return () => window.clearTimeout(timer);
  }, [highlight]);

  function locate(id: string) {
    const row = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[data-message-id]') ?? [],
    ).find((node) => node.dataset.messageId === id);
    if (row) {
      row.scrollIntoView({ block: 'center' });
      setHighlight(id);
    } else void read('around', id);
  }

  const chronological = [...messages].reverse();
  return (
    <div className="space-y-4">
      <header className="border-ink/15 border-b border-dashed pb-4">
        <h2 className="font-heading text-ink text-3xl">世界聊天</h2>
        <p className="text-ink-secondary mt-2 text-sm">
          按频道时间流查看最近 30
          天的记录。点击玩家姓名或「管理」设置账号禁言，最长 24
          小时，到期自动解除，禁言期间仍可查看聊天。
        </p>
      </header>
      <section
        className="border-ink/15 bg-paper border border-dashed"
        aria-label="世界聊天频道"
      >
        <div className="border-ink/15 flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
          <span className="text-sm">
            世界频道 ·{' '}
            {pagination.hasMoreAfter ? '历史记录' : '最新消息（每 5 秒更新）'}
          </span>
          <InkButton disabled={loading} onClick={() => void read('latest')}>
            回到最新
          </InkButton>
        </div>
        {error ? (
          <div role="alert" className="text-crimson px-4 py-2 text-sm">
            {error}{' '}
            <InkButton disabled={loading} onClick={() => void read('latest')}>
              重试
            </InkButton>
          </div>
        ) : null}
        <div
          ref={listRef}
          className="battle-scroll h-[65dvh] min-h-80 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-2 md:px-5"
          onScroll={() => {
            const list = listRef.current;
            if (list)
              following.current =
                list.scrollHeight - list.scrollTop - list.clientHeight < 80;
            if (
              list &&
              list.scrollTop < 40 &&
              stateRef.current.pagination.hasMoreBefore &&
              !busy.current
            )
              void read('before');
          }}
        >
          <div className="text-center">
            <InkButton
              disabled={loading || !pagination.hasMoreBefore}
              onClick={() => void read('before')}
            >
              {loading
                ? '正在读取……'
                : pagination.hasMoreBefore
                  ? '加载更早消息'
                  : '已到最早记录'}
            </InkButton>
          </div>
          {!loading && !messages.length ? (
            <p className="text-ink-secondary py-10 text-center text-sm">
              世界频道暂无记录
            </p>
          ) : null}
          {chronological.map((message, index) => {
            const previous = chronological[index - 1];
            const date = dateLabel(message.createdAt);
            const mute = mutes[message.senderUserId];
            const muted = mute && +new Date(mute.expiresAt) > now;
            return (
              <Fragment key={message.id}>
                {!previous || dateLabel(previous.createdAt) !== date ? (
                  <p className="text-ink-secondary my-3 text-center text-xs">
                    {date}
                  </p>
                ) : null}
                <WorldChatMessageItem
                  message={message}
                  readOnly
                  onModerateSender={setTarget}
                  onLocateReply={locate}
                  highlighted={highlight === message.id}
                  onSelectRedPacket={() => {
                    if ('packet' in message.payload)
                      setPacket(message.payload.packet);
                  }}
                />
                {muted ? (
                  <p className="text-crimson mb-2 ml-9 text-xs">
                    已禁言 · 至{' '}
                    {new Date(mute.expiresAt).toLocaleString('zh-CN')} ·{' '}
                    {mute.reason}
                  </p>
                ) : null}
              </Fragment>
            );
          })}
          {pagination.hasMoreAfter ? (
            <div className="text-center">
              <InkButton disabled={loading} onClick={() => void read('after')}>
                加载较新消息
              </InkButton>
            </div>
          ) : null}
        </div>
      </section>
      {target ? (
        <ModerationDialog
          key={target.senderUserId}
          message={target}
          now={now}
          onClose={() => setTarget(null)}
          onChanged={(mute) => {
            setMutes((previous) => {
              const next = { ...previous };
              if (mute) next[target.senderUserId] = mute;
              else delete next[target.senderUserId];
              return next;
            });
            pushToast({
              message: mute ? '已禁言该账号' : '已解除该账号禁言',
              tone: 'success',
            });
          }}
        />
      ) : null}
      {packet ? (
        <InkModal
          isOpen
          title="灵石红包"
          onClose={() => setPacket(null)}
          footer={<InkButton onClick={() => setPacket(null)}>关闭</InkButton>}
        >
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-ink-secondary">祝福语</dt>
              <dd>{packet.greeting}</dd>
            </div>
            <div>
              <dt className="text-ink-secondary">总额 / 剩余份数</dt>
              <dd className="font-mono">
                {packet.amount.toLocaleString()} / {packet.remainingCount}（共{' '}
                {packet.count} 份）
              </dd>
            </div>
            <div>
              <dt className="text-ink-secondary">状态</dt>
              <dd>
                {packet.status === 'open'
                  ? '可领取'
                  : packet.status === 'expired'
                    ? '已过期'
                    : '已领完'}
              </dd>
            </div>
            <div>
              <dt className="text-ink-secondary">到期时间</dt>
              <dd className="font-mono">
                {new Date(packet.expiresAt).toLocaleString('zh-CN')}
              </dd>
            </div>
          </dl>
        </InkModal>
      ) : null}
    </div>
  );
}

function ModerationDialog({
  message,
  now,
  onClose,
  onChanged,
}: {
  message: WorldChatMessageDTO;
  now: number;
  onClose(): void;
  onChanged(mute: AdminWorldChatMute | null): void;
}) {
  const [mute, setMute] = useState<AdminWorldChatMute | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('60');
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setReady(false);
      void request<{ success: true; data: AdminWorldChatMute | null }>(
        `${API}/mutes/${encodeURIComponent(message.senderUserId)}`,
        { signal: controller.signal },
      )
        .then((response) => {
          if (!controller.signal.aborted) {
            setMute(response.data);
            setReady(true);
            setError('');
          }
        })
        .catch((cause: unknown) => {
          if (!controller.signal.aborted)
            setError(
              cause instanceof Error ? cause.message : '禁言状态读取失败',
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [message.senderUserId, attempt]);

  async function submit(unmute = false) {
    if (pending || loading || !ready) return;
    setPending(true);
    setError('');
    try {
      const result = await request<{
        success: true;
        data: AdminWorldChatMute | null;
      }>(`${API}/mutes/${encodeURIComponent(message.senderUserId)}`, {
        method: unmute ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(unmute
          ? {}
          : {
              body: JSON.stringify({
                reason: reason.trim(),
                durationMinutes: Number(duration),
              }),
            }),
      });
      onChanged(result.data);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败，请重试');
    } finally {
      setPending(false);
    }
  }
  const active = mute && +new Date(mute.expiresAt) > now;
  return (
    <InkModal
      isOpen
      title={`发言管理 · ${message.senderName}`}
      onClose={() => {
        if (!pending) onClose();
      }}
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <InkButton disabled={pending} onClick={onClose}>
            取消
          </InkButton>
          {active ? (
            <InkButton
              pending={pending}
              disabled={loading}
              onClick={() => void submit(true)}
            >
              解除禁言
            </InkButton>
          ) : null}
          <InkButton
            variant="primary"
            pending={pending}
            disabled={loading || !ready || !reason.trim()}
            onClick={() => void submit()}
          >
            {active ? '更新禁言' : '确认禁言'}
          </InkButton>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-ink-secondary text-sm">
          禁言作用于该账号的所有角色，仅限制世界频道发言，最长 24
          小时，到期自动解除。
        </p>
        {loading ? (
          <p className="text-sm">正在读取禁言状态……</p>
        ) : active ? (
          <div className="border-crimson/20 bg-crimson/5 space-y-1 border p-3 text-sm">
            <p>
              当前禁言：至 {new Date(mute.expiresAt).toLocaleString('zh-CN')}
            </p>
            <p className="break-words">原因：{mute.reason}</p>
          </div>
        ) : (
          <p className="text-sm">当前未禁言</p>
        )}
        {error ? (
          <div role="alert" className="text-crimson text-sm">
            {error}
            <InkButton onClick={() => setAttempt((value) => value + 1)}>
              重新读取
            </InkButton>
          </div>
        ) : null}
        <InkSelect
          label="禁言时长"
          value={duration}
          onChange={setDuration}
          disabled={loading || pending}
        >
          <option value="5">5 分钟</option>
          <option value="30">30 分钟</option>
          <option value="60">1 小时</option>
          <option value="360">6 小时</option>
          <option value="720">12 小时</option>
          <option value="1440">24 小时</option>
        </InkSelect>
        <InkInput
          label="禁言原因"
          multiline
          rows={3}
          maxLength={200}
          value={reason}
          onChange={setReason}
          disabled={loading || pending}
          placeholder="说明违规行为，最多 200 字"
        />
      </div>
    </InkModal>
  );
}
