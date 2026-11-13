import { CharacterCardTrigger } from '@app/components/feature/character-card/CharacterCardTrigger';
import { ChatMessageFrame } from '@app/components/feature/chat/ChatMessageFrame';
import { ChatTextComposer } from '@app/components/feature/chat/ChatTextComposer';
import { socialRequest } from '@app/components/feature/friends/socialApi';
import { GameLoadingState } from '@app/components/game-shell';
import { InkButton, InkNotice } from '@app/components/ui';
import { apiFetch } from '@app/lib/api/fetch';
import {
  realtimeClient,
  type RealtimeConnectionState,
} from '@app/lib/realtime/realtimeClient';
import {
  readDirectChatStorage,
  writeDirectChatStorage,
} from '@app/lib/social/drafts';
import type {
  DirectConversationDTO,
  DirectMessageDTO,
  DirectMessagesPage,
} from '@daoyou/contracts/direct-messages';
import { SendDirectMessageSchema } from '@daoyou/contracts/direct-messages';
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

type PendingMessage = { clientMessageId: string; text: string; error?: string };
const merge = (left: DirectMessageDTO[], right: DirectMessageDTO[]) =>
  [
    ...new Map(
      [...left, ...right].map((message) => [message.id, message]),
    ).values(),
  ].sort((a, b) => a.sequence - b.sequence);
function dateLabel(createdAt: string) {
  const date = new Date(createdAt),
    today = new Date(),
    yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return '今天';
  if (date.toDateString() === yesterday.toDateString()) return '昨天';
  return date.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  });
}

export function DirectChatPanel({
  conversationId,
  identity,
  onBack,
  onDetails,
  obscured,
  onConversation,
}: {
  conversationId: string;
  identity: string;
  onBack: () => void;
  onDetails: (conversation: DirectConversationDTO) => void;
  obscured: boolean;
  onConversation: (conversation: DirectConversationDTO) => void;
}) {
  const [connection, setConnection] =
    useState<RealtimeConnectionState>('connecting');
  useEffect(
    () =>
      realtimeClient.subscribeStatus((status) =>
        setConnection(status.channels.social.state),
      ),
    [],
  );
  const [conversation, setConversation] =
    useState<DirectConversationDTO | null>(null);
  useEffect(() => {
    if (conversation) onConversation(conversation);
  }, [conversation, onConversation]);
  const [messages, setMessages] = useState<DirectMessageDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [older, setOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [hasNewer, setHasNewer] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const draftKey = `direct-draft:v1:${identity}:${conversationId}`;
  const pendingKey = `direct-pending:v1:${identity}:${conversationId}`;
  const [draft, setDraftState] = useState(
    () => readDirectChatStorage(draftKey) ?? '',
  );
  const [pending, setPending] = useState<PendingMessage[]>(() => {
    try {
      const stored: unknown = JSON.parse(
        readDirectChatStorage(pendingKey) ?? '[]',
      );
      return Array.isArray(stored)
        ? stored
            .filter(
              (item): item is PendingMessage =>
                item &&
                typeof item.clientMessageId === 'string' &&
                typeof item.text === 'string',
            )
            .map((item) => ({ ...item, error: '发送结果待确认，可重试' }))
        : [];
    } catch {
      return [];
    }
  });
  const logRef = useRef<HTMLDivElement>(null);
  const geometryRef = useRef({ width: 0, height: 0 });
  const readingAnchorRef = useRef<{ id: string; offset: number } | null>(null);
  const [returnAnchor, setReturnAnchor] = useState<{
    id: string;
    offset: number;
  } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialReadRef = useRef<number | null>(null);
  const cursorRef = useRef<string | null>(null);
  const beforeRef = useRef<string | null>(null);
  const syncingRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const followingRef = useRef(true);
  const lastReadRef = useRef(0);
  const readBusy = useRef(false);
  const prependAnchorRef = useRef<{ id: string; offset: number } | null>(null);
  const [following, setFollowing] = useState(true);

  // Activity keeps the conversation state, while hiding its DOM resets native
  // scroll offsets. Restore the visible message when this pane becomes active.
  useLayoutEffect(() => {
    const log = logRef.current;
    if (!log) return;
    const anchor = readingAnchorRef.current;
    if (followingRef.current) log.scrollTop = log.scrollHeight;
    else if (anchor) {
      const node = Array.from(
        log.querySelectorAll<HTMLElement>('[data-message-id]'),
      ).find((item) => item.dataset.messageId === anchor.id);
      if (node)
        log.scrollTop +=
          node.getBoundingClientRect().top -
          log.getBoundingClientRect().top -
          anchor.offset;
    }
  }, []);

  const setDraft = (value: string) => {
    setDraftState(value);
    if (value) writeDirectChatStorage(draftKey, value);
    else writeDirectChatStorage(draftKey, null);
  };
  useEffect(() => {
    if (pending.length)
      writeDirectChatStorage(pendingKey, JSON.stringify(pending));
    else writeDirectChatStorage(pendingKey, null);
  }, [pending, pendingKey]);

  const readVisible = useCallback(async () => {
    const log = logRef.current;
    if (
      !log ||
      !log.clientHeight ||
      obscured ||
      document.querySelector('[role=dialog]') ||
      document.visibilityState !== 'visible' ||
      readBusy.current
    )
      return;
    const bounds = log.getBoundingClientRect();
    const viewport = window.visualViewport;
    const visibleTop = Math.max(bounds.top, viewport?.offsetTop ?? 0);
    const visibleBottom = Math.min(
      bounds.bottom,
      (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight),
    );
    let latest: { id: string; sequence: number } | undefined;
    for (const node of log.querySelectorAll<HTMLElement>('[data-message-id]')) {
      const rect = node.getBoundingClientRect();
      const sequence = Number(node.dataset.sequence);
      if (
        node.dataset.mine !== 'true' &&
        sequence <= Number(cursorRef.current ?? 0) &&
        rect.top < visibleBottom &&
        rect.bottom > visibleTop &&
        sequence > lastReadRef.current &&
        (!latest || sequence > latest.sequence)
      )
        latest = { id: node.dataset.messageId!, sequence };
    }
    if (!latest) return;
    readBusy.current = true;
    try {
      const result = await socialRequest<{ lastReadSequence: number }>(
        `/api/direct-messages/conversations/${conversationId}/read`,
        { messageId: latest.id },
        'PUT',
      );
      lastReadRef.current = Math.max(
        lastReadRef.current,
        result.lastReadSequence,
      );
    } catch {
      /* Keep the old watermark so the next visible read can retry. */
    } finally {
      readBusy.current = false;
    }
  }, [conversationId, obscured]);

  const sync = useCallback(async () => {
    if (
      !conversationId ||
      (syncingRef.current && !controllerRef.current?.signal.aborted)
    )
      return;
    syncingRef.current = true;
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      let after = cursorRef.current;
      for (let batch = 0; batch < 5; batch += 1) {
        const params = new URLSearchParams({ limit: '50' });
        if (after !== null) params.set('afterCursor', after);
        const response = await apiFetch(
          `/api/direct-messages/conversations/${conversationId}/messages?${params}`,
          { signal: controller.signal },
        );
        let result = (await response.json()) as DirectMessagesPage & {
          error?: string;
        };
        if (!response.ok) throw new Error(result.error || '暂时无法读取私聊');
        if (controller.signal.aborted) return;
        if (
          after === null &&
          result.conversation.unreadCount > 0 &&
          result.messages[0] &&
          result.messages[0].sequence > result.conversation.lastReadSequence + 1
        ) {
          const unread = await apiFetch(
            `/api/direct-messages/conversations/${conversationId}/messages?limit=50&afterCursor=${result.conversation.lastReadSequence}`,
            { signal: controller.signal },
          );
          if (!unread.ok) throw new Error('未读消息读取失败');
          result = (await unread.json()) as DirectMessagesPage;
          followingRef.current = false;
          setFollowing(false);
        }
        if (
          initialReadRef.current === null ||
          (initialReadRef.current === -1 &&
            result.conversation.unreadCount > 0 &&
            !followingRef.current)
        )
          initialReadRef.current = result.conversation.unreadCount
            ? result.conversation.lastReadSequence
            : -1;
        setConversation(result.conversation);
        lastReadRef.current = Math.max(
          lastReadRef.current,
          result.conversation.lastReadSequence,
        );
        if (after === null) {
          beforeRef.current = result.pagination.beforeCursor;
          setHasOlder(result.pagination.hasMoreBefore);
        }
        setMessages((previous) => merge(previous, result.messages));
        setPending((previous) =>
          previous.filter(
            (item) =>
              !result.messages.some(
                (message) =>
                  message.mine &&
                  message.clientMessageId === item.clientMessageId,
              ),
          ),
        );
        cursorRef.current = result.pagination.afterCursor;
        setHasNewer(result.pagination.hasMoreAfter);
        after = result.pagination.afterCursor;
        if (!result.pagination.hasMoreAfter || !followingRef.current) break;
      }
      setError('');
    } catch (error) {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : '私聊读取失败');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      if (controllerRef.current === controller) syncingRef.current = false;
    }
  }, [conversationId]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') void sync();
    };
    void sync();
    const off = realtimeClient.subscribe('social.changed', ({ payload }) => {
      if (
        payload.kind === 'friends' ||
        !payload.conversationId ||
        payload.conversationId === conversationId
      )
        refresh();
    });
    const offReady = realtimeClient.subscribe('ready', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      controllerRef.current?.abort();
      off();
      offReady();
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(timer);
    };
  }, [conversationId, sync]);

  useLayoutEffect(() => {
    const anchor = prependAnchorRef.current;
    const log = logRef.current;
    prependAnchorRef.current = null;
    if (!anchor || !log || followingRef.current) return;
    const node = Array.from(
      log.querySelectorAll<HTMLElement>('[data-message-id]'),
    ).find((item) => item.dataset.messageId === anchor.id);
    if (node) {
      const offset =
        node.getBoundingClientRect().top - log.getBoundingClientRect().top;
      log.scrollTop += offset - anchor.offset;
    }
  }, [messages]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (followingRef.current && logRef.current)
        logRef.current.scrollTop = logRef.current.scrollHeight;
      void readVisible();
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, pending, readVisible]);

  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    const observer = new ResizeObserver(() => {
      if (followingRef.current) log.scrollTop = log.scrollHeight;
      geometryRef.current = {
        width: log.clientWidth,
        height: log.clientHeight,
      };
      void readVisible();
    });
    observer.observe(log);
    return () => observer.disconnect();
  }, [readVisible]);

  async function loadOlder() {
    if (!beforeRef.current || older) return;
    setOlder(true);
    const log = logRef.current;
    followingRef.current = false;
    setFollowing(false);
    try {
      const response = await apiFetch(
        `/api/direct-messages/conversations/${conversationId}/messages?beforeCursor=${beforeRef.current}&limit=50`,
      );
      const result = (await response.json()) as DirectMessagesPage & {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || '历史消息读取失败');
      beforeRef.current = result.pagination.beforeCursor;
      setHasOlder(result.pagination.hasMoreBefore);
      if (log && !followingRef.current) {
        const bounds = log.getBoundingClientRect();
        const firstVisible = Array.from(
          log.querySelectorAll<HTMLElement>('[data-message-id]'),
        ).find((node) => {
          const rect = node.getBoundingClientRect();
          return rect.bottom > bounds.top && rect.top < bounds.bottom;
        });
        prependAnchorRef.current = firstVisible
          ? {
              id: firstVisible.dataset.messageId!,
              offset: firstVisible.getBoundingClientRect().top - bounds.top,
            }
          : null;
      }
      setMessages((previous) => merge(previous, result.messages));
    } catch (error) {
      setError(error instanceof Error ? error.message : '历史消息读取失败');
    } finally {
      setOlder(false);
    }
  }

  async function send(item?: PendingMessage) {
    if ((!conversation?.canSend && !item) || sending) return;
    if (!item && pending.length >= 10) return;
    const next = item ?? {
      clientMessageId: crypto.randomUUID(),
      text: draft.trim(),
    };
    const parsed = SendDirectMessageSchema.safeParse({
      clientMessageId: next.clientMessageId,
      text: next.text,
    });
    if (!parsed.success) return;
    if (!item) {
      followingRef.current = true;
      setFollowing(true);
      setPending((previous) => [...previous, next]);
      setDraft('');
    }
    setSending(next.clientMessageId);
    setPending((previous) =>
      previous.map((message) =>
        message.clientMessageId === next.clientMessageId
          ? { ...message, error: undefined }
          : message,
      ),
    );
    try {
      const result = await socialRequest<{ message: DirectMessageDTO }>(
        `/api/direct-messages/conversations/${conversationId}/messages`,
        parsed.data,
      );
      setMessages((previous) => merge(previous, [result.message]));
      setPending((previous) =>
        previous.filter(
          (message) => message.clientMessageId !== next.clientMessageId,
        ),
      );
      await sync();
    } catch (error) {
      setPending((previous) =>
        previous.map((message) =>
          message.clientMessageId === next.clientMessageId
            ? {
                ...message,
                error:
                  error instanceof Error
                    ? error.message
                    : '发送结果未确认，可重试',
              }
            : message,
        ),
      );
      void sync();
    } finally {
      setSending(null);
      if (!matchMedia('(pointer: coarse)').matches) inputRef.current?.focus();
    }
  }

  const unreadStart = messages.find(
    (message) =>
      !message.mine &&
      initialReadRef.current !== null &&
      initialReadRef.current >= 0 &&
      message.sequence > initialReadRef.current,
  )?.id;
  return (
    <>
      <div className="border-ink/15 flex min-h-12 shrink-0 items-center justify-between gap-2 border-b border-dashed pb-2">
        <div className="flex min-w-0 items-center gap-1">
          <InkButton
            variant="secondary"
            className="min-h-11 md:hidden"
            onClick={onBack}
          >
            道友列表
          </InkButton>
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {conversation?.peer.name ?? '接续私聊……'}
            </p>
            <p className="text-ink-secondary text-xs" role="status">
              {connection === 'offline'
                ? '连接已断开'
                : connection === 'blocked'
                  ? '暂时无法连接'
                  : connection === 'connecting' || connection === 'reconnecting'
                    ? '正在接续……'
                    : conversation?.canSend
                      ? '私聊'
                      : conversation?.archived
                        ? '往昔会话 · 只读'
                        : '暂时无法发送'}
            </p>
          </div>
        </div>
        {conversation ? (
          <InkButton
            variant="secondary"
            className="min-h-11 shrink-0"
            onClick={() => onDetails(conversation)}
          >
            道友资料
          </InkButton>
        ) : null}
      </div>
      {error ? (
        <div
          role="alert"
          className="text-crimson flex shrink-0 items-center justify-between gap-2 py-2 text-sm"
        >
          <span>{error}</span>
          <InkButton onClick={() => void sync()}>重试</InkButton>
        </div>
      ) : null}
      <div
        ref={logRef}
        className="direct-chat-timeline battle-scroll min-h-0 flex-1 overflow-y-auto pr-1"
        role="log"
        aria-label="私聊消息"
        aria-live="polite"
        onScroll={() => {
          const log = logRef.current;
          if (!log || !log.clientHeight) return;
          const geometry = geometryRef.current;
          const resized =
            geometry.width !== log.clientWidth ||
            geometry.height !== log.clientHeight;
          geometryRef.current = {
            width: log.clientWidth,
            height: log.clientHeight,
          };
          if (resized && followingRef.current && !hasNewer) {
            log.scrollTop = log.scrollHeight;
            void readVisible();
            return;
          }
          const nearBottom =
            log.scrollHeight - log.scrollTop - log.clientHeight < 48;
          followingRef.current = nearBottom && !hasNewer;
          setFollowing(followingRef.current);
          const bounds = log.getBoundingClientRect();
          const firstVisible = Array.from(
            log.querySelectorAll<HTMLElement>('[data-message-id]'),
          ).find((node) => node.getBoundingClientRect().bottom > bounds.top);
          readingAnchorRef.current = firstVisible
            ? {
                id: firstVisible.dataset.messageId!,
                offset: firstVisible.getBoundingClientRect().top - bounds.top,
              }
            : null;
          if (log.scrollTop < 48 && hasOlder && !older) void loadOlder();
          void readVisible();
        }}
      >
        {loading && !conversation ? (
          <GameLoadingState message="正在接续私聊……" variant="inline" />
        ) : null}
        {hasOlder ? (
          <div className="flex min-h-11 justify-center">
            <InkButton
              variant="secondary"
              pending={older}
              onClick={() => void loadOlder()}
            >
              查看更早消息
            </InkButton>
          </div>
        ) : messages.length ? (
          <p className="text-ink-secondary py-3 text-center text-xs">
            已到历史起点 · 可查看近 30 天消息
          </p>
        ) : null}
        {!loading && !messages.length && !error ? (
          <p className="text-ink-secondary py-8 text-center text-sm">
            尚无消息，向道友问声好吧
          </p>
        ) : null}
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const differentDate =
            !previous ||
            dateLabel(previous.createdAt) !== dateLabel(message.createdAt);
          const elapsed = previous
            ? new Date(message.createdAt).getTime() -
              new Date(previous.createdAt).getTime()
            : Infinity;
          const grouped =
            !differentDate &&
            message.id !== unreadStart &&
            !!message.senderCultivatorId &&
            previous.senderCultivatorId === message.senderCultivatorId &&
            previous.senderName === message.senderName &&
            !previous.expired &&
            !message.expired &&
            elapsed >= 0 &&
            elapsed < 120000;
          return (
            <Fragment key={message.id}>
              {message.id === unreadStart ? (
                <p className="text-teal py-2 text-center text-xs">
                  以下为未读消息
                </p>
              ) : null}
              {differentDate ? (
                <div className="text-ink-secondary flex items-center gap-3 py-3 text-xs">
                  <span className="bg-ink/10 h-px flex-1" />
                  <span>{dateLabel(message.createdAt)}</span>
                  <span className="bg-ink/10 h-px flex-1" />
                </div>
              ) : null}
              <ChatMessageFrame
                messageId={message.id}
                sequence={message.sequence}
                mine={message.mine}
                senderName={message.senderName}
                createdAt={message.createdAt}
                own={message.mine}
                grouped={grouped}
                sender={
                  message.senderCultivatorId ? (
                    <CharacterCardTrigger
                      id={message.senderCultivatorId}
                      name={message.senderName}
                    >
                      <span className="font-semibold">
                        {message.senderName}
                      </span>
                    </CharacterCardTrigger>
                  ) : undefined
                }
              >
                {message.expired ? (
                  <span className="text-ink-secondary italic">
                    此条消息正文已过保留期
                  </span>
                ) : (
                  message.text
                )}
              </ChatMessageFrame>
            </Fragment>
          );
        })}
        {pending.map((message) => (
          <div
            key={message.clientMessageId}
            className="bg-teal/5 my-1.5 ml-9 px-2.5 py-1.5 text-sm leading-6"
          >
            <p className="break-words whitespace-pre-wrap">{message.text}</p>
            <div className="text-ink-secondary mt-1 flex flex-wrap items-center gap-2 text-sm">
              {sending === message.clientMessageId ? (
                '发送中……'
              ) : (
                <>
                  <span className="text-crimson">
                    {message.error ?? '待确认发送结果'}
                  </span>
                  <InkButton
                    disabled={!!sending || !conversation}
                    onClick={() => void send(message)}
                  >
                    重试
                  </InkButton>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {returnAnchor || !following || hasNewer ? (
        <div className="flex shrink-0 justify-center gap-3 py-1">
          {returnAnchor ? (
            <InkButton
              variant="secondary"
              className="min-h-11"
              onClick={() => {
                const log = logRef.current;
                const node =
                  log &&
                  Array.from(
                    log.querySelectorAll<HTMLElement>('[data-message-id]'),
                  ).find((item) => item.dataset.messageId === returnAnchor.id);
                if (log && node) {
                  followingRef.current = false;
                  setFollowing(false);
                  log.scrollTop +=
                    node.getBoundingClientRect().top -
                    log.getBoundingClientRect().top -
                    returnAnchor.offset;
                }
                setReturnAnchor(null);
              }}
            >
              返回刚才位置
            </InkButton>
          ) : null}
          {!following || hasNewer ? (
            <InkButton
              variant="primary"
              className="min-h-11"
              onClick={() => {
                const log = logRef.current;
                if (log && !returnAnchor) {
                  const bounds = log.getBoundingClientRect();
                  const node = Array.from(
                    log.querySelectorAll<HTMLElement>('[data-message-id]'),
                  ).find(
                    (item) => item.getBoundingClientRect().bottom > bounds.top,
                  );
                  if (node)
                    setReturnAnchor({
                      id: node.dataset.messageId!,
                      offset: node.getBoundingClientRect().top - bounds.top,
                    });
                }
                followingRef.current = true;
                setFollowing(true);
                if (logRef.current)
                  logRef.current.scrollTop = logRef.current.scrollHeight;
                void sync();
                void readVisible();
              }}
            >
              ↓{' '}
              {conversation?.unreadCount
                ? `${conversation.unreadCount} 条新消息`
                : hasNewer
                  ? '读取新消息'
                  : '回到最新'}
            </InkButton>
          ) : null}
        </div>
      ) : null}
      <div className="border-ink/15 shrink-0 border-t border-dashed pt-2">
        {conversation && !conversation.canSend ? (
          <div className="py-2">
            <p className="text-ink-secondary text-sm leading-7">
              {conversation.unavailableReason || '当前会话仅可阅读。'}
            </p>
            {!conversation.archived && conversation.peer.cultivatorId ? (
              <InkButton
                href={`/game/friends?chat=${conversationId}&addFriend=${conversation.peer.cultivatorId}`}
              >
                查看好友关系
              </InkButton>
            ) : null}
          </div>
        ) : (
          <>
            {pending.length >= 10 ? (
              <InkNotice tone="warning">
                已有 10 条待确认消息，请先重试；新内容仍保留在草稿。
              </InkNotice>
            ) : null}
            <ChatTextComposer
              inputId={`direct-chat-input-${conversationId}`}
              inputRef={inputRef}
              draft={draft}
              maxChars={500}
              placeholder="与道友说点什么……"
              label="私聊内容"
              posting={!!sending}
              sendDisabled={!conversation?.canSend || pending.length >= 10}
              onDraftChange={setDraft}
              onSend={() => void send()}
              leading={
                conversation?.canSend && conversation.peer.cultivatorId ? (
                  <InkButton
                    variant="secondary"
                    className="min-h-11"
                    href={`/game/mail?composeTo=${conversation.peer.cultivatorId}&conversation=${conversationId}`}
                  >
                    传音赠物
                  </InkButton>
                ) : undefined
              }
            />
          </>
        )}
      </div>
    </>
  );
}
