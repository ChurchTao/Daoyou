import { FriendTargetModal } from '@app/components/feature/friends';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { InkNotice } from '@app/components/ui/InkNotice';
import { cn } from '@app/lib/cn';
import {
  realtimeClient,
  type RealtimeConnectionState,
} from '@app/lib/realtime/realtimeClient';
import {
  useCultivatorIdentity,
  usePlayerSession,
} from '@app/lib/resources/player';
import type {
  WorldChatChannel as Channel,
  WorldChatMessageDTO,
} from '@daoyou/contracts/world-chat';
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { WorldChatMessageItem } from './WorldChatMessageItem';
import {
  WorldChatGiveRedPacketDialog,
  WorldChatRedPacketDialog,
  WorldChatRefundsDialog,
} from './WorldChatRedPacketDialog';
import { WorldChatShowcaseDialog } from './WorldChatShowcaseDialog';
import { WorldChatTextComposer } from './WorldChatTextComposer';
import { useWorldChatFeedModel } from './useWorldChatFeedModel';
import { useWorldChatViewport } from './useWorldChatViewport';
import './worldChatViewport.css';

type Anchor = { id: string; offset: number };
type ChannelView = {
  draft: string;
  reply: WorldChatMessageDTO | null;
  anchor: Anchor | null;
  following: boolean;
};
const viewCache = new Map<string, Record<Channel, ChannelView>>();
const cachedSectIds = new Map<string, string | null>();
const channels: { id: Channel; label: string; icon: string }[] = [
  { id: 'world', label: '世界', icon: '🌐' },
  { id: 'sect', label: '宗门', icon: '⛩️' },
  { id: 'system', label: '系统', icon: '📜' },
];
function emptyViews(): Record<Channel, ChannelView> {
  return {
    world: { draft: '', reply: null, anchor: null, following: true },
    sect: { draft: '', reply: null, anchor: null, following: true },
    system: { draft: '', reply: null, anchor: null, following: true },
  };
}
function dateLabel(createdAt: string) {
  const date = new Date(createdAt);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return '今天';
  if (date.toDateString() === yesterday.toDateString()) return '昨天';
  return new Intl.DateTimeFormat('zh-CN', {
    ...(date.getFullYear() !== today.getFullYear()
      ? { year: 'numeric' as const }
      : {}),
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function WorldChatChannel() {
  const actorId = useCultivatorIdentity().data?.cultivator?.id ?? '';
  const sectId = usePlayerSession().data?.activeCultivator?.sectId ?? null;
  return (
    <WorldChatChannelBody
      key={`${actorId}:${sectId ?? ''}`}
      actorId={actorId}
      sectId={sectId}
    />
  );
}

function WorldChatChannelBody({
  actorId,
  sectId,
}: {
  actorId: string;
  sectId: string | null;
}) {
  const feed = useWorldChatFeedModel();
  const {
    markVisible,
    setFollowingLatest,
    activeChannel,
    loading,
    messages,
    locateMessage,
  } = feed;
  const { pushToast } = useInkUI();
  const [views, setViews] = useState(() => {
    const saved = viewCache.get(actorId);
    return saved
      ? {
          ...saved,
          sect:
            cachedSectIds.get(actorId) === sectId
              ? saved.sect
              : emptyViews().sect,
        }
      : emptyViews();
  });
  const viewsRef = useRef({
    world: { ...views.world },
    sect: { ...views.sect },
    system: { ...views.system },
  });
  const attemptedRestore = useRef(new Set<Channel>());
  const activeChannelRef = useRef(feed.activeChannel);
  const operationGeneration = useRef(0);
  const mounted = useRef(true);
  const listRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const loadingHistoryRef = useRef(false);
  const pendingPosition = useRef<{
    anchor?: Anchor;
    locateId?: string;
    latest?: boolean;
  } | null>(null);
  const [scrollRevision, setScrollRevision] = useState(0);
  const [following, setFollowing] = useState(
    () => views[feed.activeChannel].following,
  );
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const [giveOpen, setGiveOpen] = useState(false);
  const [refundsOpen, setRefundsOpen] = useState(false);
  const [packetId, setPacketId] = useState<string | null>(null);
  const [friendTargetId, setFriendTargetId] = useState<string | null>(null);
  const [returnAnchor, setReturnAnchor] = useState<Anchor | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [claimedPackets, setClaimedPackets] = useState<Set<string>>(
    () => new Set(),
  );
  const [connection, setConnection] =
    useState<RealtimeConnectionState>('connecting');
  const { height, keyboardViewport } = useWorldChatViewport(workspaceRef);
  const view = views[feed.activeChannel];
  const displayMessages = useMemo(
    () => [...feed.messages].reverse(),
    [feed.messages],
  );
  const unreadCount = feed.unreadCounts[feed.activeChannel];
  const unreadStart =
    !feed.hasNewer && unreadCount > 0 && unreadCount <= displayMessages.length
      ? displayMessages[displayMessages.length - unreadCount]?.id
      : null;
  const canSend =
    feed.activeChannel !== 'system' &&
    (feed.activeChannel !== 'sect' || feed.hasSect);

  useLayoutEffect(() => {
    const previous = viewsRef.current;
    viewsRef.current = {
      world: {
        ...views.world,
        anchor: previous.world.anchor,
        following: previous.world.following,
      },
      sect: {
        ...views.sect,
        anchor: previous.sect.anchor,
        following: previous.sect.following,
      },
      system: {
        ...views.system,
        anchor: previous.system.anchor,
        following: previous.system.following,
      },
    };
    viewCache.set(actorId, viewsRef.current);
    cachedSectIds.set(actorId, sectId);
  }, [views, actorId, sectId]);
  useLayoutEffect(() => {
    activeChannelRef.current = feed.activeChannel;
  }, [feed.activeChannel]);
  useEffect(
    () =>
      realtimeClient.subscribeStatus((status) =>
        setConnection(status.channels['world-chat'].state),
      ),
    [],
  );
  useEffect(() => {
    if (!highlight) return;
    const timer = window.setTimeout(() => setHighlight(null), 2_000);
    return () => window.clearTimeout(timer);
  }, [highlight]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (cachedSectIds.get(actorId) === sectId)
        viewCache.set(actorId, viewsRef.current);
    };
  }, [actorId, sectId]);
  useEffect(() => {
    if (loading || attemptedRestore.current.has(activeChannel)) return;
    const current = viewsRef.current[activeChannel];
    attemptedRestore.current.add(activeChannel);
    if (
      !current.following &&
      current.anchor &&
      !messages.some((message) => message.id === current.anchor!.id)
    ) {
      pendingPosition.current = { anchor: current.anchor };
      void locateMessage(current.anchor.id);
    }
  }, [activeChannel, loading, messages, locateMessage]);

  const captureAnchor = useCallback((): Anchor | null => {
    const list = listRef.current;
    if (!list) return null;
    const top = list.getBoundingClientRect().top;
    const row = Array.from(
      list.querySelectorAll<HTMLElement>('[data-message-id]'),
    ).find((node) => node.getBoundingClientRect().bottom > top);
    return row
      ? {
          id: row.dataset.messageId!,
          offset: row.getBoundingClientRect().top - top,
        }
      : null;
  }, []);

  const restoreAnchor = useCallback((anchor: Anchor) => {
    const list = listRef.current;
    const row = Array.from(
      list?.querySelectorAll<HTMLElement>('[data-message-id]') ?? [],
    ).find((node) => node.dataset.messageId === anchor.id);
    if (list && row) {
      const delta =
        row.getBoundingClientRect().top -
        list.getBoundingClientRect().top -
        anchor.offset;
      if (Math.abs(delta) > 1) list.scrollTop += delta;
    }
    return !!row;
  }, []);
  const stickToBottom = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const bottom = Math.max(0, list.scrollHeight - list.clientHeight);
    if (Math.abs(bottom - list.scrollTop) > 1) list.scrollTop = bottom;
  }, []);

  const reportVisible = useCallback(() => {
    const list = listRef.current;
    if (
      !list ||
      document.visibilityState !== 'visible' ||
      document.querySelector('[role="dialog"][aria-modal="true"]')
    )
      return;
    const rect = list.getBoundingClientRect();
    const viewport = window.visualViewport;
    const visibleTop = Math.max(rect.top, viewport?.offsetTop ?? 0);
    const visibleBottom = Math.min(
      rect.bottom,
      viewport ? viewport.offsetTop + viewport.height : window.innerHeight,
    );
    if (visibleBottom <= visibleTop) return;
    const rows = Array.from(
      list.querySelectorAll<HTMLElement>('[data-message-id]'),
    );
    const last = rows
      .filter((row) => {
        const box = row.getBoundingClientRect();
        return box.top < visibleBottom && box.bottom > visibleTop;
      })
      .at(-1);
    if (last?.dataset.messageId) markVisible(last.dataset.messageId);
  }, [markVisible]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const current = viewsRef.current[feed.activeChannel];
    const pending = pendingPosition.current;
    if (pending?.locateId) {
      const row = Array.from(
        list.querySelectorAll<HTMLElement>('[data-message-id]'),
      ).find((node) => node.dataset.messageId === pending.locateId);
      if (row) {
        list.scrollTop +=
          row.getBoundingClientRect().top -
          list.getBoundingClientRect().top -
          Math.min(80, list.clientHeight / 4);
        pendingPosition.current = null;
      }
    } else if (
      pending?.latest ||
      (!pending && current.following && !feed.hasNewer)
    ) {
      stickToBottom();
      pendingPosition.current = null;
    } else if (pending?.anchor ?? current.anchor) {
      if (restoreAnchor((pending?.anchor ?? current.anchor)!))
        pendingPosition.current = null;
    }
    if (!pendingPosition.current)
      viewsRef.current[feed.activeChannel] = {
        ...current,
        anchor: captureAnchor(),
        following: pending?.latest
          ? true
          : pending?.locateId
            ? false
            : current.following,
      };
    const frame = requestAnimationFrame(reportVisible);
    return () => cancelAnimationFrame(frame);
  }, [
    displayMessages,
    feed.activeChannel,
    feed.hasNewer,
    feed.pendingMessages,
    height,
    keyboardViewport,
    scrollRevision,
    reportVisible,
    restoreAnchor,
    captureAnchor,
    stickToBottom,
  ]);

  useEffect(() => {
    const content = contentRef.current;
    const list = listRef.current;
    if (!content || !list) return;
    const observer = new ResizeObserver(() => {
      const current = viewsRef.current[feed.activeChannel];
      if (current.following && !feed.hasNewer) stickToBottom();
      else if (current.anchor) restoreAnchor(current.anchor);
      reportVisible();
    });
    observer.observe(content);
    const visible = () => reportVisible();
    document.addEventListener('visibilitychange', visible);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', visible);
    };
  }, [
    feed.activeChannel,
    feed.hasNewer,
    reportVisible,
    restoreAnchor,
    stickToBottom,
  ]);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input) {
      input.style.height = 'auto';
      input.style.height = `${Math.min(128, Math.max(44, input.scrollHeight))}px`;
    }
  }, [view.draft]);

  function changeDraft(draft: string) {
    setViews((current) => ({
      ...current,
      [feed.activeChannel]: { ...current[feed.activeChannel], draft },
    }));
  }
  const selectReply = useCallback(
    (message: WorldChatMessageDTO) => {
      setViews((current) => ({
        ...current,
        [activeChannel]: { ...current[activeChannel], reply: message },
      }));
      inputRef.current?.focus();
    },
    [activeChannel],
  );
  function switchChannel(channel: Channel) {
    if (channel === feed.activeChannel) return;
    operationGeneration.current += 1;
    const anchor = captureAnchor();
    const current = viewsRef.current;
    current[feed.activeChannel] = { ...current[feed.activeChannel], anchor };
    const next = current[channel];
    pendingPosition.current = next.following
      ? { latest: true }
      : next.anchor
        ? { anchor: next.anchor }
        : null;
    setFollowing(next.following);
    setReturnAnchor(null);
    setHighlight(null);
    feed.setActiveChannel(channel);
    setViews({ ...current });
  }
  async function older() {
    if (!feed.hasMore || feed.loadingMore || loadingHistoryRef.current) return;
    loadingHistoryRef.current = true;
    const anchor = captureAnchor();
    if (anchor) pendingPosition.current = { anchor };
    try {
      await feed.loadMore();
    } finally {
      loadingHistoryRef.current = false;
    }
  }
  function scroll() {
    const list = listRef.current;
    if (!list) return;
    const isFollowing =
      !feed.hasNewer &&
      list.scrollHeight - list.scrollTop - list.clientHeight < 48;
    viewsRef.current[feed.activeChannel] = {
      ...viewsRef.current[feed.activeChannel],
      anchor: captureAnchor(),
      following: isFollowing,
    };
    setFollowing(isFollowing);
    setFollowingLatest(isFollowing);
    reportVisible();
    if (list.scrollTop < 200 && !feed.loadError) void older();
    if (
      list.scrollHeight - list.scrollTop - list.clientHeight < 180 &&
      feed.hasNewer &&
      !feed.loadingNewer
    )
      void feed.loadNewer();
  }
  async function latest() {
    const channel = feed.activeChannel;
    const generation = operationGeneration.current;
    const previous = captureAnchor();
    if (!following && previous && !returnAnchor) setReturnAnchor(previous);
    await feed.returnToLatest();
    if (
      !mounted.current ||
      activeChannelRef.current !== channel ||
      operationGeneration.current !== generation
    )
      return;
    viewsRef.current[feed.activeChannel] = {
      ...viewsRef.current[feed.activeChannel],
      following: true,
    };
    pendingPosition.current = { latest: true };
    setFollowing(true);
    setScrollRevision((value) => value + 1);
  }
  const locate = useCallback(
    async (id: string) => {
      const channel = activeChannel;
      const generation = ++operationGeneration.current;
      const previous = captureAnchor();
      if (previous) setReturnAnchor(previous);
      const found = await locateMessage(id);
      if (
        !mounted.current ||
        activeChannelRef.current !== channel ||
        operationGeneration.current !== generation
      )
        return;
      if (found) {
        viewsRef.current[channel].following = false;
        setFollowing(false);
        setHighlight(id);
        pendingPosition.current = { locateId: id };
        setScrollRevision((value) => value + 1);
      } else pushToast({ message: '原消息已过期或不可见', tone: 'warning' });
    },
    [activeChannel, captureAnchor, locateMessage, pushToast],
  );
  async function returnToReading() {
    if (!returnAnchor) return;
    const channel = feed.activeChannel;
    const generation = ++operationGeneration.current;
    const found = await feed.locateMessage(returnAnchor.id);
    if (
      !mounted.current ||
      activeChannelRef.current !== channel ||
      operationGeneration.current !== generation
    )
      return;
    if (found) {
      pendingPosition.current = { anchor: returnAnchor };
      viewsRef.current[feed.activeChannel].following = false;
      setFollowing(false);
      setHighlight(null);
      setReturnAnchor(null);
      setScrollRevision((value) => value + 1);
    } else {
      setReturnAnchor(null);
      pushToast({ message: '原阅读位置已过期', tone: 'warning' });
    }
  }
  async function send() {
    const text = view.draft.trim();
    if (
      !text ||
      Array.from(text).length > 100 ||
      feed.posting ||
      feed.cooldownRemaining > 0
    )
      return;
    const channel = feed.activeChannel;
    const replyToMessageId = view.reply?.id;
    changeDraft('');
    setViews((current) => ({
      ...current,
      [channel]: { ...current[channel], reply: null },
    }));
    void latest();
    await feed.sendTextMessage(text, replyToMessageId);
  }
  const status =
    connection === 'online'
      ? '已连接'
      : connection === 'reconnecting'
        ? '正在恢复'
        : connection === 'offline' || connection === 'blocked'
          ? '暂时离线'
          : '连接中';

  return (
    <div className="world-chat-slot" style={{ height }}>
      <div
        ref={workspaceRef}
        className="world-chat-workspace"
        data-keyboard={keyboardViewport ? '' : undefined}
        style={
          keyboardViewport
            ? {
                top: keyboardViewport.top,
                height: keyboardViewport.height,
              }
            : undefined
        }
      >
        <nav
          aria-label="聊天频道"
          className="border-ink/15 flex shrink-0 gap-2 border-b border-dashed pb-2 md:w-36 md:flex-col md:border-r md:border-b-0 md:pr-3 md:pb-0"
        >
          {channels.map((channel) => (
            <button
              type="button"
              key={channel.id}
              aria-pressed={feed.activeChannel === channel.id}
              disabled={channel.id === 'sect' && !feed.hasSect}
              onClick={() => switchChannel(channel.id)}
              className={cn(
                'flex min-h-11 flex-1 items-center justify-center gap-2 px-2 text-base disabled:opacity-50 md:flex-none md:justify-start',
                feed.activeChannel === channel.id
                  ? 'bg-ink/5 text-crimson font-semibold'
                  : 'text-ink-secondary hover:text-ink',
              )}
            >
              <GameIcon value={channel.icon} />
              <span>{channel.label}</span>
              {channel.id === 'sect' && !feed.hasSect ? (
                <span className="text-xs">未入宗</span>
              ) : feed.unreadCounts[channel.id] > 0 ? (
                <span className="text-teal ml-auto font-mono text-xs">
                  {feed.unreadCounts[channel.id] > 99
                    ? '99+'
                    : feed.unreadCounts[channel.id]}
                </span>
              ) : null}
            </button>
          ))}
          <InkButton
            className="hidden min-h-11 md:mt-auto md:inline-flex"
            variant="secondary"
            onClick={() => setRefundsOpen(true)}
          >
            红包待退款
          </InkButton>
        </nav>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col md:pl-4">
          <div className="text-ink-secondary flex shrink-0 items-center justify-between gap-2 py-2 text-sm">
            <span>
              {feed.activeChannel === 'sect'
                ? '同门传音'
                : feed.activeChannel === 'system'
                  ? '修仙界见闻'
                  : '诸界闲谈'}
            </span>
            <span role="status">{status}</span>
          </div>
          <div
            ref={listRef}
            className="world-chat-timeline battle-scroll min-h-0 flex-1 overflow-y-auto pr-1"
            onScroll={scroll}
          >
            <div ref={contentRef}>
              {feed.loading && !feed.messages.length ? (
                <GameLoadingState message="正在接引传音……" variant="inline" />
              ) : null}
              {feed.loadError ? (
                <InkNotice tone="warning">
                  {feed.loadError}{' '}
                  <InkButton
                    onClick={() =>
                      void (feed.messages.length
                        ? older()
                        : feed.returnToLatest())
                    }
                  >
                    重试
                  </InkButton>
                </InkNotice>
              ) : null}
              {feed.hasMore ? (
                <div className="flex min-h-11 justify-center">
                  <InkButton
                    onClick={() => void older()}
                    pending={feed.loadingMore}
                    pendingLabel="接引早前传音……"
                    variant="secondary"
                  >
                    查看更早消息
                  </InkButton>
                </div>
              ) : feed.messages.length ? (
                <p className="text-ink-secondary py-3 text-center text-xs">
                  已到历史起点 · 可查看近 30 天消息
                </p>
              ) : null}
              {!feed.loading && !feed.messages.length ? (
                <p className="text-ink-secondary py-8 text-center">
                  {feed.activeChannel === 'sect' && !feed.hasSect
                    ? '尚未拜入宗门'
                    : feed.activeChannel === 'system'
                      ? '暂无修仙界见闻'
                      : '暂无传音，向道友问声好吧'}
                </p>
              ) : null}
              {displayMessages.map((message, index) => {
                const previous = displayMessages[index - 1];
                const date = dateLabel(message.createdAt);
                const differentDate =
                  !previous || date !== dateLabel(previous.createdAt);
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
                  previous.senderRealm === message.senderRealm &&
                  previous.senderRealmStage === message.senderRealmStage &&
                  previous.messageType === 'text' &&
                  message.messageType === 'text' &&
                  !message.reply &&
                  !previous.reply &&
                  elapsed >= 0 &&
                  elapsed < 120_000;
                const packet =
                  message.messageType === 'red_packet' &&
                  'packet' in message.payload
                    ? message.payload.packet
                    : null;
                return (
                  <Fragment key={message.id}>
                    {message.id === unreadStart ? (
                      <p className="text-teal py-2 text-center text-xs">
                        以下为未读传音
                      </p>
                    ) : null}
                    {differentDate ? (
                      <div className="text-ink-secondary flex items-center gap-3 py-3 text-xs">
                        <span className="bg-ink/10 h-px flex-1" />
                        <span>{date}</span>
                        <span className="bg-ink/10 h-px flex-1" />
                      </div>
                    ) : null}
                    <WorldChatMessageItem
                      message={message}
                      grouped={grouped}
                      highlighted={highlight === message.id}
                      claimed={!!packet && claimedPackets.has(packet.id)}
                      onSelectFriend={setFriendTargetId}
                      onReply={canSend ? selectReply : undefined}
                      onLocateReply={locate}
                      onSelectRedPacket={setPacketId}
                    />
                  </Fragment>
                );
              })}
              {feed.loadingNewer ? (
                <p className="text-ink-secondary py-3 text-center text-sm">
                  正在接引后续传音……
                </p>
              ) : null}
              {feed.pendingMessages.map((message) => (
                <div
                  key={message.clientMessageId}
                  className="bg-teal/5 my-1.5 ml-9 px-2.5 py-1.5 text-sm leading-6"
                >
                  <p className="break-words whitespace-pre-wrap">
                    {message.text}
                  </p>
                  <div className="text-ink-secondary mt-1 flex flex-wrap items-center gap-2 text-sm">
                    {message.status === 'sending' ? (
                      '发送中……'
                    ) : (
                      <>
                        <span className="text-crimson">
                          {message.error || '未发送'}
                        </span>
                        <InkButton
                          disabled={feed.cooldownRemaining > 0 || feed.posting}
                          onClick={() =>
                            void feed.retryMessage(message.clientMessageId)
                          }
                        >
                          重试
                        </InkButton>
                        <InkButton
                          onClick={() => {
                            changeDraft(message.text);
                            inputRef.current?.focus();
                          }}
                        >
                          编辑
                        </InkButton>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {returnAnchor || !following || feed.hasNewer ? (
            <div className="flex shrink-0 justify-center gap-3 py-1">
              {returnAnchor ? (
                <InkButton
                  variant="secondary"
                  className="min-h-11"
                  onClick={() => void returnToReading()}
                >
                  返回刚才位置
                </InkButton>
              ) : null}
              {!following || feed.hasNewer ? (
                <InkButton
                  variant="primary"
                  className="min-h-11"
                  onClick={() => void latest()}
                >
                  {feed.unreadCounts[feed.activeChannel] > 0
                    ? `↓ ${feed.unreadCounts[feed.activeChannel]} 条新消息`
                    : '↓ 回到最新'}
                </InkButton>
              ) : null}
            </div>
          ) : null}
          {canSend ? (
            <div className="border-ink/15 shrink-0 border-t border-dashed pt-2">
              <WorldChatTextComposer
                inputId="world-chat-input"
                inputRef={inputRef}
                draft={view.draft}
                maxChars={100}
                placeholder="与道友说点什么……"
                label="传音内容"
                posting={feed.posting}
                cooldownRemaining={feed.cooldownRemaining}
                sendDisabled={
                  connection === 'offline' || connection === 'blocked'
                }
                reply={view.reply}
                onDraftChange={changeDraft}
                onClearReply={() =>
                  setViews((current) => ({
                    ...current,
                    [feed.activeChannel]: {
                      ...current[feed.activeChannel],
                      reply: null,
                    },
                  }))
                }
                onSend={() => void send()}
                leading={
                  <>
                    <InkButton
                      disabled={feed.posting}
                      className="min-h-11"
                      variant="secondary"
                      onClick={() => setShowcaseOpen(true)}
                    >
                      <GameIcon value="📦" className="mr-1" />
                      展示
                    </InkButton>
                    <InkButton
                      disabled={feed.posting}
                      className="min-h-11"
                      variant="secondary"
                      onClick={() => setGiveOpen(true)}
                    >
                      <GameIcon value="🧧" className="mr-1" />
                      红包
                    </InkButton>
                    <InkButton
                      className="min-h-11 md:hidden"
                      variant="secondary"
                      onClick={() => setRefundsOpen(true)}
                    >
                      待退款
                    </InkButton>
                  </>
                }
              />
            </div>
          ) : null}
        </div>
      </div>
      <FriendTargetModal
        targetId={friendTargetId}
        onClose={() => setFriendTargetId(null)}
      />
      {showcaseOpen && canSend ? (
        <WorldChatShowcaseDialog
          key={feed.activeChannel}
          channelName={feed.activeChannel === 'sect' ? '宗门' : '世界'}
          posting={feed.posting}
          send={async (input) => {
            const sent = await feed.sendShowcaseMessage({
              ...input,
              replyToMessageId: view.reply?.id,
            });
            if (sent) {
              setViews((current) => ({
                ...current,
                [feed.activeChannel]: {
                  ...current[feed.activeChannel],
                  reply: null,
                },
              }));
              void latest();
            }
            return sent;
          }}
          onClose={() => setShowcaseOpen(false)}
        />
      ) : null}
      {giveOpen && canSend ? (
        <WorldChatGiveRedPacketDialog
          onSent={() => void latest()}
          onClose={() => setGiveOpen(false)}
        />
      ) : null}
      {packetId ? (
        <WorldChatRedPacketDialog
          key={packetId}
          packetId={packetId}
          onClaimed={(id) =>
            setClaimedPackets((current) => new Set(current).add(id))
          }
          onClose={() => setPacketId(null)}
        />
      ) : null}
      {refundsOpen ? (
        <WorldChatRefundsDialog onClose={() => setRefundsOpen(false)} />
      ) : null}
    </div>
  );
}
