import { useInkUI } from '@app/components/providers/InkUIProvider';
import { apiFetch } from '@app/lib/api/fetch';
import { useAuth } from '@app/lib/auth/authContext';
import { realtimeClient } from '@app/lib/realtime/realtimeClient';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { usePlayerSession } from '@app/lib/resources/player';
import type { PlayerStateMutationResponse } from '@daoyou/contracts/player';
import type {
  RedPacketSummary,
  WorldChatChannel,
  WorldChatCreateMessageRequest,
  WorldChatMessageDTO,
} from '@daoyou/contracts/world-chat';
import { WorldChatRedPacketMessageSchema } from '@daoyou/contracts/world-chat';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router';
import {
  WorldChatFeedContext,
  type PendingWorldChatMessage,
  type SendRedPacketInput,
  type WorldChatFeedModel,
} from './worldChatFeedContext';
import {
  MAX_CHAT_WINDOW,
  mergeWorldChatMessages,
  PAGE_SIZE,
} from './worldChatFeedHelpers';

type ChannelFeed = {
  messages: WorldChatMessageDTO[];
  recent: WorldChatMessageDTO[];
  syncCursor: string | null;
  hasMore: boolean;
  hasNewer: boolean;
  loading: boolean;
  loadingMore: boolean;
  loadingNewer: boolean;
  error: string | null;
  initialized: boolean;
  following: boolean;
};
type PendingMessage = PendingWorldChatMessage & {
  channel: WorldChatChannel;
  identity: string;
};
type ListResponse = {
  success: boolean;
  error?: string;
  data: WorldChatMessageDTO[];
  cooldownRemainingSeconds?: number;
  pagination?: {
    beforeCursor: string | null;
    afterCursor: string | null;
    hasMore: boolean;
    hasMoreBefore?: boolean;
    hasMoreAfter?: boolean;
  };
};
type ReadMode = 'latest' | 'before' | 'after' | 'around' | 'sync';
const CHANNELS: WorldChatChannel[] = ['world', 'sect', 'system'];
const emptySeen = (): Record<WorldChatChannel, number> => ({
  world: 0,
  sect: 0,
  system: 0,
});
function emptyFeed(): ChannelFeed {
  return {
    messages: [],
    recent: [],
    syncCursor: null,
    hasMore: false,
    hasNewer: false,
    loading: false,
    loadingMore: false,
    loadingNewer: false,
    error: null,
    initialized: false,
    following: true,
  };
}
const emptyFeeds = (): Record<WorldChatChannel, ChannelFeed> => ({
  world: emptyFeed(),
  sect: emptyFeed(),
  system: emptyFeed(),
});
function readSeen(userId: string | undefined, sectId: string | null) {
  if (!userId) return emptySeen();
  try {
    const value = JSON.parse(
      sessionStorage.getItem('chat:read:' + userId) ?? '{}',
    ) as Record<string, unknown>;
    const seen = Object.fromEntries(
      CHANNELS.map((channel) => [
        channel,
        typeof value[channel] === 'number' &&
        Number.isSafeInteger(value[channel])
          ? value[channel]
          : 0,
      ]),
    ) as Record<WorldChatChannel, number>;
    const sectSeen = Number(
      sessionStorage.getItem('chat:read:' + userId + ':sect:' + sectId),
    );
    seen.sect = sectId && Number.isSafeInteger(sectSeen) ? sectSeen : 0;
    return seen;
  } catch {
    return emptySeen();
  }
}
function readChannel(
  userId: string | undefined,
  hasSect: boolean,
): WorldChatChannel {
  try {
    const channel = sessionStorage.getItem('chat:channel:' + userId);
    if (channel === 'system' || (channel === 'sect' && hasSect)) return channel;
  } catch {
    /* Channel selection works without storage. */
  }
  return 'world';
}

function readPendingPackets(identity: string) {
  try {
    const stored = JSON.parse(
      sessionStorage.getItem('chat:pending-packets:' + identity) ?? '{}',
    ) as Record<string, unknown>;
    const result: Partial<Record<WorldChatChannel, SendRedPacketInput>> = {};
    for (const channel of ['world', 'sect'] as const) {
      const input = stored[channel];
      if (!input || typeof input !== 'object') continue;
      const parsed = WorldChatRedPacketMessageSchema.safeParse({
        ...input,
        messageType: 'red_packet',
      });
      if (parsed.success) {
        const { amount, count, mode, greeting, clientMessageId } = parsed.data;
        result[channel] = { amount, count, mode, greeting, clientMessageId };
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function WorldChatFeedProvider({ children }: { children: ReactNode }) {
  const { pushToast } = useInkUI();
  const { user } = useAuth();
  const location = useLocation();
  const session = usePlayerSession();
  const sectId = session.data?.activeCultivator?.sectId ?? null;
  const identity =
    user?.id +
    ':' +
    (session.data?.activeCultivator?.id ?? '') +
    ':' +
    (sectId ?? '');
  const identityRef = useRef(identity);
  const identityEpoch = useRef(0);
  const previousIdentity = useRef(identity);
  const isWorldChatRoute = location.pathname === '/game/world-chat';
  const [activeChannel, changeChannel] = useState<WorldChatChannel>(() =>
    readChannel(user?.id, Boolean(sectId)),
  );
  const [feeds, setFeeds] = useState(emptyFeeds);
  const feedsRef = useRef(feeds);
  const [previewMessages, setPreviewMessages] = useState<WorldChatMessageDTO[]>(
    [],
  );
  const [seen, setSeen] = useState(() => readSeen(user?.id, sectId));
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [pendingPackets, setPendingPackets] = useState(() =>
    readPendingPackets(identity),
  );
  const [posting, setPosting] = useState(false);
  const postingRef = useRef(false);
  const [deadlines, setDeadlines] = useState(emptySeen);
  const [now, setNow] = useState(Date.now);
  const requests = useRef(new Map<string, Promise<ListResponse | null>>());
  const windowEpoch = useRef(emptySeen());

  useLayoutEffect(() => {
    if (identityRef.current !== identity) {
      identityEpoch.current += 1;
      feedsRef.current = emptyFeeds();
    } else feedsRef.current = feeds;
    identityRef.current = identity;
  }, [identity, feeds]);

  const setActiveChannel = useCallback(
    (channel: WorldChatChannel) => {
      changeChannel(channel);
      try {
        sessionStorage.setItem('chat:channel:' + user?.id, channel);
      } catch {
        /* Optional preference. */
      }
    },
    [user?.id],
  );

  useEffect(() => {
    if (!isWorldChatRoute) return;
    const channel = new URLSearchParams(location.search).get('channel');
    if (
      channel === 'world' ||
      channel === 'system' ||
      (channel === 'sect' && sectId)
    ) {
      queueMicrotask(() => setActiveChannel(channel));
    }
  }, [isWorldChatRoute, location.search, sectId, setActiveChannel]);
  const rememberPacket = useCallback(
    (channel: WorldChatChannel, input: SendRedPacketInput | null) => {
      const next =
        identityRef.current === identity
          ? { ...pendingPackets }
          : readPendingPackets(identity);
      if (input) next[channel] = input;
      else delete next[channel];
      try {
        sessionStorage.setItem(
          'chat:pending-packets:' + identity,
          JSON.stringify(next),
        );
      } catch {
        /* In-memory recovery remains available. */
      }
      if (identityRef.current === identity) setPendingPackets(next);
    },
    [identity, pendingPackets],
  );

  const setCooldown = useCallback(
    (channel: WorldChatChannel, seconds?: number) => {
      if (seconds === undefined) return;
      setDeadlines((current) => ({
        ...current,
        [channel]: Date.now() + seconds * 1000,
      }));
      setNow(Date.now());
    },
    [],
  );

  useEffect(() => {
    if (Math.max(...Object.values(deadlines)) <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadlines]);

  const readPage = useCallback(
    (channel: WorldChatChannel, mode: ReadMode, cursor?: string) => {
      if (channel === 'sect' && !sectId) return Promise.resolve(null);
      const requestedIdentity = identity;
      const requestedEpoch = identityEpoch.current;
      const key =
        requestedIdentity +
        ':' +
        requestedEpoch +
        ':' +
        channel +
        ':' +
        mode +
        ':' +
        (cursor ?? '');
      const existing = requests.current.get(key);
      if (existing) return existing;
      if (mode === 'latest' || mode === 'around')
        windowEpoch.current[channel] += 1;
      const requestedWindow = windowEpoch.current[channel];
      const task = (async (): Promise<ListResponse | null> => {
        setFeeds((current) => ({
          ...current,
          [channel]: {
            ...current[channel],
            error: null,
            loading: current[channel].messages.length === 0,
            loadingMore: mode === 'before',
            loadingNewer: mode === 'after',
          },
        }));
        try {
          const query = new URLSearchParams({ pageSize: String(PAGE_SIZE) });
          if (channel !== 'sect') query.set('channel', channel);
          if (cursor)
            query.set(
              mode === 'before'
                ? 'beforeCursor'
                : mode === 'around'
                  ? 'aroundMessageId'
                  : 'afterCursor',
              cursor,
            );
          const endpoint =
            channel === 'sect'
              ? '/api/sects/current/chat/messages'
              : '/api/world-chat/messages';
          const response = await apiFetch(endpoint + '?' + query, {
            cache: 'no-store',
          });
          const payload = (await response.json()) as ListResponse;
          if (!response.ok || !payload.success)
            throw new Error(payload.error || '获取传音失败');
          if (
            identityRef.current !== requestedIdentity ||
            identityEpoch.current !== requestedEpoch
          )
            return null;
          if (
            mode !== 'sync' &&
            windowEpoch.current[channel] !== requestedWindow
          )
            return null;
          setCooldown(channel, payload.cooldownRemainingSeconds);
          setFeeds((current) => {
            const feed = current[channel];
            const incoming = payload.data;
            const replacing = mode === 'latest' || mode === 'around';
            const known = mergeWorldChatMessages(
              mergeWorldChatMessages(feed.recent, feed.messages),
              incoming,
            );
            const recent = known.slice(0, MAX_CHAT_WINDOW);
            const incomingIds = new Set(incoming.map((message) => message.id));
            const incomingHead = Math.max(
              0,
              ...incoming.map((message) => message.sequence),
            );
            let messages = replacing
              ? known.filter(
                  (message) =>
                    incomingIds.has(message.id) ||
                    (mode === 'latest' && message.sequence > incomingHead),
                )
              : mergeWorldChatMessages(feed.messages, incoming);
            if (
              mode === 'sync' &&
              (!feed.following ||
                windowEpoch.current[channel] !== requestedWindow)
            )
              messages = feed.messages;
            const trimmed = messages.length > MAX_CHAT_WINDOW;
            messages =
              mode === 'before'
                ? messages.slice(-MAX_CHAT_WINDOW)
                : messages.slice(0, MAX_CHAT_WINDOW);
            const pagination = payload.pagination;
            return {
              ...current,
              [channel]: {
                ...feed,
                messages,
                recent,
                syncCursor:
                  mode === 'latest' || mode === 'sync'
                    ? (pagination?.afterCursor ?? feed.syncCursor)
                    : feed.syncCursor,
                hasMore:
                  mode === 'before' || replacing
                    ? Boolean(pagination?.hasMoreBefore ?? pagination?.hasMore)
                    : feed.hasMore || trimmed,
                hasNewer:
                  (recent[0]?.sequence ?? 0) > (messages[0]?.sequence ?? 0) ||
                  (mode === 'before'
                    ? feed.hasNewer || trimmed
                    : replacing || mode === 'after'
                      ? Boolean(
                          pagination?.hasMoreAfter ??
                          (mode === 'after' && pagination?.hasMore),
                        )
                      : feed.hasNewer ||
                        (!feed.following && incoming.length > 0)),
                following:
                  mode === 'latest'
                    ? true
                    : mode === 'before' || mode === 'around'
                      ? false
                      : feed.following,
                initialized: true,
                loading: false,
                loadingMore: false,
                loadingNewer: false,
                error: null,
              },
            };
          });
          if (channel !== 'sect') {
            setPreviewMessages((current) =>
              mergeWorldChatMessages(current, payload.data).slice(0, PAGE_SIZE),
            );
          }
          return payload;
        } catch (error) {
          if (
            identityRef.current !== requestedIdentity ||
            identityEpoch.current !== requestedEpoch ||
            (mode !== 'sync' &&
              windowEpoch.current[channel] !== requestedWindow)
          )
            return null;
          setFeeds((current) => ({
            ...current,
            [channel]: {
              ...current[channel],
              loading: false,
              loadingMore: false,
              loadingNewer: false,
              error: error instanceof Error ? error.message : '获取传音失败',
            },
          }));
          return null;
        } finally {
          requests.current.delete(key);
        }
      })();
      requests.current.set(key, task);
      return task;
    },
    [identity, sectId, setCooldown],
  );

  const synchronize = useCallback(async () => {
    for (const channel of CHANNELS) {
      if (channel === 'sect' && !sectId) continue;
      let cursor = feedsRef.current[channel].syncCursor;
      if (!cursor) {
        await readPage(channel, 'latest');
        continue;
      }
      let more = true;
      while (more) {
        const result = await readPage(channel, 'sync', cursor);
        const nextCursor = result?.pagination?.afterCursor;
        more = Boolean(
          result?.pagination?.hasMoreAfter ?? result?.pagination?.hasMore,
        );
        if (!result || !nextCursor || nextCursor === cursor) break;
        cursor = nextCursor;
      }
    }
  }, [readPage, sectId]);

  useEffect(() => {
    if (previousIdentity.current === identity) return;
    previousIdentity.current = identity;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      feedsRef.current = emptyFeeds();
      setFeeds(feedsRef.current);
      setPending([]);
      setPendingPackets(readPendingPackets(identity));
      setSeen(readSeen(user?.id, sectId));
      setDeadlines(emptySeen());
      setPreviewMessages([]);
      postingRef.current = false;
      setPosting(false);
      changeChannel(readChannel(user?.id, Boolean(sectId)));
    });
    return () => {
      cancelled = true;
    };
  }, [identity, sectId, user?.id]);

  useEffect(() => {
    if (isWorldChatRoute) void synchronize();
  }, [isWorldChatRoute, synchronize]);

  const refreshPreview = useCallback(async () => {
    const requestedIdentity = identity;
    try {
      const response = await apiFetch(
        '/api/world-chat/messages?channel=all&limit=30',
        { cache: 'no-store' },
      );
      const payload = (await response.json()) as ListResponse;
      if (
        !response.ok ||
        !payload.success ||
        identityRef.current !== requestedIdentity
      )
        return;
      setPreviewMessages((current) =>
        mergeWorldChatMessages(current, payload.data).slice(0, PAGE_SIZE),
      );
      setFeeds((current) => {
        const next = { ...current };
        for (const channel of ['world', 'system'] as const) {
          next[channel] = {
            ...current[channel],
            recent: mergeWorldChatMessages(
              current[channel].recent,
              payload.data.filter((m) => m.channel === channel),
            ).slice(0, MAX_CHAT_WINDOW),
          };
        }
        return next;
      });
    } catch {
      /* The preview keeps its last known message while offline. */
    }
  }, [identity]);

  useEffect(() => {
    if (!isWorldChatRoute) void refreshPreview();
  }, [isWorldChatRoute, refreshPreview]);

  useEffect(() => {
    realtimeClient.enableChannel('world-chat');
    return () => realtimeClient.disableChannel('world-chat');
  }, []);

  const acceptMessage = useCallback(
    (message: WorldChatMessageDTO) => {
      if (message.channel === 'sect' && message.sectId !== sectId) return;
      setFeeds((current) => {
        const feed = current[message.channel];
        const shouldAppend = feed.following && !feed.hasNewer;
        const merged = mergeWorldChatMessages(feed.messages, [message]);
        return {
          ...current,
          [message.channel]: {
            ...feed,
            messages: shouldAppend
              ? merged.slice(0, MAX_CHAT_WINDOW)
              : feed.messages,
            recent: mergeWorldChatMessages(feed.recent, [message]).slice(
              0,
              MAX_CHAT_WINDOW,
            ),
            hasMore:
              feed.hasMore || (shouldAppend && merged.length > MAX_CHAT_WINDOW),
            hasNewer:
              feed.hasNewer ||
              (!shouldAppend &&
                !feed.messages.some((m) => m.id === message.id)),
          },
        };
      });
      if (message.channel !== 'sect') {
        setPreviewMessages((current) =>
          mergeWorldChatMessages(current, [message]).slice(0, PAGE_SIZE),
        );
      }
      if (message.clientMessageId && message.senderUserId === user?.id) {
        setPending((current) =>
          current.filter((p) => p.clientMessageId !== message.clientMessageId),
        );
      }
    },
    [sectId, user?.id],
  );

  const refreshRedPacket = useCallback((packet: RedPacketSummary) => {
    const update = (messages: WorldChatMessageDTO[]) =>
      messages.map((message) => {
        if (
          message.messageType !== 'red_packet' ||
          !('packet' in message.payload) ||
          message.payload.packet.id !== packet.id ||
          message.payload.packet.revision > packet.revision
        )
          return message;
        return { ...message, payload: { version: 1 as const, packet } };
      });
    setFeeds(
      (current) =>
        Object.fromEntries(
          CHANNELS.map((channel) => [
            channel,
            {
              ...current[channel],
              messages: update(current[channel].messages),
              recent: update(current[channel].recent),
            },
          ]),
        ) as Record<WorldChatChannel, ChannelFeed>,
    );
    setPreviewMessages(update);
  }, []);

  useEffect(
    () =>
      realtimeClient.subscribe('world-chat.message', (event) =>
        acceptMessage(event.payload),
      ),
    [acceptMessage],
  );
  useEffect(
    () =>
      realtimeClient.subscribe('world-chat.red-packet', (event) => {
        if (event.payload.channel !== 'sect' || event.payload.sectId === sectId)
          refreshRedPacket(event.payload.packet);
      }),
    [refreshRedPacket, sectId],
  );

  useEffect(() => {
    let lastConnectedAt: number | null = null;
    let restoring = false;
    return realtimeClient.subscribeStatus((status) => {
      const chat = status.channels['world-chat'];
      if (chat.state !== 'online' || chat.lastConnectedAt === lastConnectedAt)
        return;
      if (lastConnectedAt !== null && !restoring) {
        restoring = true;
        void (isWorldChatRoute ? synchronize() : refreshPreview()).finally(
          () => {
            restoring = false;
          },
        );
      }
      lastConnectedAt = chat.lastConnectedAt;
    });
  }, [isWorldChatRoute, refreshPreview, synchronize]);

  const markVisible = useCallback(
    (id: string) => {
      if (!isWorldChatRoute || document.visibilityState !== 'visible') return;
      const feed = feedsRef.current[activeChannel];
      const message = feed.messages.find((m) => m.id === id);
      if (!message) return;
      setFeeds((current) =>
        current[activeChannel].following ===
        (current[activeChannel].recent[0]?.id === id)
          ? current
          : {
              ...current,
              [activeChannel]: {
                ...current[activeChannel],
                following: current[activeChannel].recent[0]?.id === id,
              },
            },
      );
      setSeen((current) => {
        if (current[activeChannel] >= message.sequence) return current;
        const next = { ...current, [activeChannel]: message.sequence };
        if (user?.id) {
          try {
            sessionStorage.setItem(
              'chat:read:' + user.id,
              JSON.stringify(next),
            );
            if (activeChannel === 'sect' && sectId) {
              sessionStorage.setItem(
                'chat:read:' + user.id + ':sect:' + sectId,
                String(message.sequence),
              );
            }
          } catch {
            /* Reading works without storage. */
          }
        }
        return next;
      });
    },
    [activeChannel, isWorldChatRoute, sectId, user?.id],
  );

  const sendBody = useCallback(
    async (channel: WorldChatChannel, body: WorldChatCreateMessageRequest) => {
      if (
        channel === 'system' ||
        (channel === 'sect' && !sectId) ||
        postingRef.current
      )
        return false;
      const requestedIdentity = identity;
      const requestedEpoch = identityEpoch.current;
      postingRef.current = true;
      setPosting(true);
      let rejected = false;
      try {
        const endpoint =
          channel === 'sect'
            ? '/api/sects/current/chat/messages'
            : '/api/world-chat/messages';
        const response = await apiFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload =
          (await response.json()) as PlayerStateMutationResponse<WorldChatMessageDTO> & {
            error?: string;
            cooldownSeconds?: number;
            remainingSeconds?: number;
            retryAfterSeconds?: number;
          };
        if (!response.ok || !payload.success) {
          rejected = response.status >= 400 && response.status < 500;
          setCooldown(
            channel,
            payload.retryAfterSeconds ?? payload.remainingSeconds,
          );
          throw new Error(payload.error || '发送失败，请重试');
        }
        if (
          identityRef.current !== requestedIdentity ||
          identityEpoch.current !== requestedEpoch
        ) {
          if (body.messageType === 'red_packet') rememberPacket(channel, null);
          return false;
        }
        const message =
          body.messageType === 'red_packet'
            ? await consumeResourceMutation<WorldChatMessageDTO>(payload)
            : payload.data;
        acceptMessage(message);
        if (body.messageType === 'red_packet') rememberPacket(channel, null);
        setCooldown(channel, payload.cooldownSeconds);
        return true;
      } catch (error) {
        if (
          identityRef.current !== requestedIdentity ||
          identityEpoch.current !== requestedEpoch
        )
          return false;
        const message =
          error instanceof Error ? error.message : '发送失败，请重试';
        if (body.messageType === 'red_packet' && rejected)
          rememberPacket(channel, null);
        if (body.messageType === 'text') {
          setPending((current) =>
            current.map((p) =>
              p.clientMessageId === body.clientMessageId
                ? { ...p, status: 'failed', error: message }
                : p,
            ),
          );
        } else pushToast({ message, tone: 'danger' });
        return false;
      } finally {
        if (identityEpoch.current === requestedEpoch) {
          postingRef.current = false;
          setPosting(false);
        }
      }
    },
    [acceptMessage, identity, pushToast, rememberPacket, sectId, setCooldown],
  );

  const sendTextMessage = useCallback(
    async (text: string, replyToMessageId?: string) => {
      if (
        postingRef.current ||
        activeChannel === 'system' ||
        (activeChannel === 'sect' && !sectId)
      )
        return false;
      const clientMessageId = crypto.randomUUID();
      setPending((current) => [
        ...current,
        {
          clientMessageId,
          text,
          replyToMessageId,
          channel: activeChannel,
          identity,
          status: 'sending',
        },
      ]);
      return sendBody(activeChannel, {
        messageType: 'text',
        textContent: text,
        payload: { text },
        clientMessageId,
        replyToMessageId,
      });
    },
    [activeChannel, identity, sectId, sendBody],
  );

  const retryMessage = useCallback(
    async (id: string) => {
      const item = pending.find(
        (p) => p.clientMessageId === id && p.identity === identity,
      );
      if (!item || item.status === 'sending' || postingRef.current)
        return false;
      setPending((current) =>
        current.map((p) =>
          p.clientMessageId === id
            ? { ...p, status: 'sending', error: undefined }
            : p,
        ),
      );
      return sendBody(item.channel, {
        messageType: 'text',
        textContent: item.text,
        payload: { text: item.text },
        clientMessageId: id,
        replyToMessageId: item.replyToMessageId,
      });
    },
    [identity, pending, sendBody],
  );

  const loadMore = useCallback(async () => {
    const feed = feedsRef.current[activeChannel];
    const oldest = feed.messages.at(-1);
    if (feed.hasMore && !feed.loadingMore && oldest)
      await readPage(activeChannel, 'before', String(oldest.sequence));
    else if (!feed.initialized || feed.error)
      await readPage(activeChannel, 'latest');
  }, [activeChannel, readPage]);
  const loadNewer = useCallback(async () => {
    const feed = feedsRef.current[activeChannel];
    if (feed.hasNewer && !feed.loadingNewer && feed.messages[0])
      await readPage(activeChannel, 'after', String(feed.messages[0].sequence));
  }, [activeChannel, readPage]);
  const locateMessage = useCallback(
    async (id: string) => {
      if (feedsRef.current[activeChannel].messages.some((m) => m.id === id))
        return true;
      const result = await readPage(activeChannel, 'around', id);
      return Boolean(result?.data.some((m) => m.id === id));
    },
    [activeChannel, readPage],
  );
  const returnToLatest = useCallback(async () => {
    await readPage(activeChannel, 'latest');
  }, [activeChannel, readPage]);

  const sendRedPacket = useCallback(
    async (input: SendRedPacketInput) => {
      if (
        postingRef.current ||
        activeChannel === 'system' ||
        (activeChannel === 'sect' && !sectId)
      )
        return false;
      const request = pendingPackets[activeChannel] ?? input;
      rememberPacket(activeChannel, request);
      return sendBody(activeChannel, { ...request, messageType: 'red_packet' });
    },
    [activeChannel, pendingPackets, rememberPacket, sectId, sendBody],
  );

  const activeFeed = feeds[activeChannel];
  const unreadCounts = useMemo(
    () =>
      Object.fromEntries(
        CHANNELS.map((channel) => [
          channel,
          feeds[channel].recent.filter(
            (message) => message.sequence > seen[channel],
          ).length,
        ]),
      ) as Record<WorldChatChannel, number>,
    [feeds, seen],
  );
  const value = useMemo<WorldChatFeedModel>(
    () => ({
      messages: activeFeed.messages,
      latestMessage: previewMessages[0] ?? null,
      newMessageCount: unreadCounts.world + unreadCounts.system,
      unreadCounts,
      loading: activeFeed.loading,
      loadingMore: activeFeed.loadingMore,
      hasMore: activeFeed.hasMore,
      hasNewer: activeFeed.hasNewer,
      loadingNewer: activeFeed.loadingNewer,
      loadError: activeFeed.error,
      cooldownRemaining: Math.max(
        0,
        Math.ceil((deadlines[activeChannel] - now) / 1000),
      ),
      pendingMessages: pending.filter(
        (item) => item.channel === activeChannel && item.identity === identity,
      ),
      posting,
      hasSect: Boolean(sectId),
      isWorldChatRoute,
      activeChannel,
      setActiveChannel,
      loadMore,
      loadNewer,
      locateMessage,
      returnToLatest,
      markVisible,
      sendTextMessage,
      retryMessage,
      refreshRedPacket,
      pendingRedPacket: pendingPackets[activeChannel] ?? null,
      redPacketOutcome: pendingPackets[activeChannel]
        ? posting
          ? 'confirming'
          : 'unknown'
        : 'idle',
      sendShowcaseMessage: (input) =>
        sendBody(activeChannel, {
          ...input,
          messageType: 'beastId' in input ? 'beast_showcase' : 'item_showcase',
          clientMessageId: crypto.randomUUID(),
        } as WorldChatCreateMessageRequest),
      sendRedPacket,
    }),
    [
      activeChannel,
      activeFeed,
      deadlines,
      identity,
      isWorldChatRoute,
      loadMore,
      loadNewer,
      locateMessage,
      markVisible,
      now,
      pending,
      pendingPackets,
      posting,
      previewMessages,
      refreshRedPacket,
      retryMessage,
      returnToLatest,
      sectId,
      sendBody,
      sendTextMessage,
      sendRedPacket,
      setActiveChannel,
      unreadCounts,
    ],
  );
  return (
    <WorldChatFeedContext.Provider value={value}>
      {children}
    </WorldChatFeedContext.Provider>
  );
}
