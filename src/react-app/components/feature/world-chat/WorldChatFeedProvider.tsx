import { useInkUI } from '@app/components/providers/InkUIProvider';
import { realtimeClient } from '@app/lib/realtime/realtimeClient';
import { usePlayerSession } from '@app/lib/resources/player';
import type {
  WorldChatChannel,
  WorldChatMessageDTO,
} from '@shared/types/world-chat';
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
  type SendWorldChatShowcaseInput,
  type WorldChatFeedModel,
} from './worldChatFeedContext';
import {
  countNewWorldChatMessages,
  mergeWorldChatMessages,
  PAGE_SIZE,
} from './worldChatFeedHelpers';

type ChannelFeed = {
  messages: WorldChatMessageDTO[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
};

const CHANNELS: WorldChatChannel[] = ['system', 'world', 'sect'];

function createEmptyFeed(): ChannelFeed {
  return {
    messages: [],
    page: 1,
    hasMore: false,
    loading: true,
    loadingMore: false,
  };
}

function createFeeds(): Record<WorldChatChannel, ChannelFeed> {
  return {
    world: createEmptyFeed(),
    sect: { ...createEmptyFeed(), loading: false },
    system: createEmptyFeed(),
  };
}

export function WorldChatFeedProvider({ children }: { children: ReactNode }) {
  const { pushToast } = useInkUI();
  const location = useLocation();
  const session = usePlayerSession();
  const sectId = session.data?.activeCultivator?.sectId ?? null;
  const hasSect = Boolean(sectId);
  const isWorldChatRoute = location.pathname === '/game/world-chat';
  const [activeChannel, setActiveChannel] =
    useState<WorldChatChannel>('system');
  const [feeds, setFeeds] = useState(createFeeds);
  const [previewMessages, setPreviewMessages] = useState<
    WorldChatMessageDTO[]
  >([]);
  const [lastSeenPreviewMessageId, setLastSeenPreviewMessageId] = useState<
    string | null
  >(null);
  const [posting, setPosting] = useState(false);
  const [lastSeenIds, setLastSeenIds] = useState<
    Record<WorldChatChannel, string | null>
  >({ world: null, sect: null, system: null });
  const initializedRef = useRef<Record<WorldChatChannel, boolean>>({
    world: false,
    sect: false,
    system: false,
  });
  const previousSectIdRef = useRef<string | null | undefined>(undefined);
  const currentSectIdRef = useRef(sectId);
  const reconnectRefreshPendingRef = useRef(false);

  useLayoutEffect(() => {
    currentSectIdRef.current = sectId;
  }, [sectId]);

  const fetchPage = useCallback(
    async (channel: WorldChatChannel, targetPage: number, append: boolean) => {
      const requestedSectId = sectId;
      if (channel === 'sect' && !sectId) {
        setFeeds((current) => ({
          ...current,
          sect: { ...createEmptyFeed(), loading: false },
        }));
        return;
      }
      setFeeds((current) => ({
        ...current,
        [channel]: {
          ...current[channel],
          loading: append ? current[channel].loading : true,
          loadingMore: append,
        },
      }));
      try {
        const endpoint =
          channel === 'sect'
            ? `/api/sects/current/chat/messages?page=${targetPage}&pageSize=${PAGE_SIZE}`
            : `/api/world-chat/messages?channel=${channel}&page=${targetPage}&pageSize=${PAGE_SIZE}`;
        const response = await fetch(endpoint, { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || '获取传音失败');
        }
        if (
          channel === 'sect' &&
          currentSectIdRef.current !== requestedSectId
        ) {
          return;
        }
        const nextMessages = (payload.data || []) as WorldChatMessageDTO[];
        const wasInitialized = initializedRef.current[channel];
        initializedRef.current[channel] = true;
        setFeeds((current) => ({
          ...current,
          [channel]: {
            messages: append
              ? mergeWorldChatMessages(
                  current[channel].messages,
                  nextMessages,
                )
              : nextMessages,
            page: targetPage,
            hasMore: Boolean(payload.pagination?.hasMore),
            loading: false,
            loadingMore: false,
          },
        }));
        if (!wasInitialized && nextMessages[0]) {
          setLastSeenIds((current) => ({
            ...current,
            [channel]: nextMessages[0].id,
          }));
        }
      } catch (error) {
        if (
          channel === 'sect' &&
          currentSectIdRef.current !== requestedSectId
        ) {
          return;
        }
        setFeeds((current) => ({
          ...current,
          [channel]: {
            ...current[channel],
            loading: false,
            loadingMore: false,
          },
        }));
        pushToast({
          message: error instanceof Error ? error.message : '获取传音失败',
          tone: 'danger',
        });
      }
    },
    [pushToast, sectId],
  );

  const fetchLatestPreview = useCallback(async () => {
    try {
      const response = await fetch(
        '/api/world-chat/messages?channel=all&limit=1',
        { cache: 'no-store' },
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || '获取传音失败');
      }
      const nextMessages = (payload.data || []) as WorldChatMessageDTO[];
      setPreviewMessages((current) =>
        mergeWorldChatMessages(current, nextMessages).slice(0, PAGE_SIZE),
      );
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '获取传音失败',
        tone: 'danger',
      });
    }
  }, [pushToast]);

  useEffect(() => {
    if (!isWorldChatRoute) {
      return;
    }
    const channels = CHANNELS.filter((channel) => channel !== 'sect' || sectId);
    for (const channel of channels) {
      if (!initializedRef.current[channel]) {
        void fetchPage(channel, 1, false);
      }
    }
  }, [fetchPage, isWorldChatRoute, sectId]);

  useEffect(() => {
    if (isWorldChatRoute) {
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        void fetchLatestPreview();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fetchLatestPreview, isWorldChatRoute]);

  useEffect(() => {
    const previousSectId = previousSectIdRef.current;
    previousSectIdRef.current = sectId;
    if (previousSectId === undefined || previousSectId === sectId) {
      return;
    }
    initializedRef.current.sect = false;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setFeeds((current) => ({ ...current, sect: createEmptyFeed() }));
      setLastSeenIds((current) => ({ ...current, sect: null }));
      if (!sectId && activeChannel === 'sect') {
        setActiveChannel('system');
      }
      if (sectId && previousSectId !== null && isWorldChatRoute) {
        void fetchPage('sect', 1, false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeChannel, fetchPage, isWorldChatRoute, sectId]);

  useEffect(() => {
    realtimeClient.enableChannel('world-chat');
    return () => realtimeClient.disableChannel('world-chat');
  }, []);

  useEffect(
    () =>
      realtimeClient.subscribe('world-chat.message', (event) => {
        const message = event.payload;
        if (message.channel === 'sect' && message.sectId !== sectId) {
          return;
        }
        setFeeds((current) => ({
          ...current,
          [message.channel]: {
            ...current[message.channel],
            messages: mergeWorldChatMessages(
              current[message.channel].messages,
              [message],
            ),
          },
        }));
        if (message.channel !== 'sect') {
          setPreviewMessages((current) =>
            mergeWorldChatMessages(current, [message]).slice(0, PAGE_SIZE),
          );
        }
        if (isWorldChatRoute && activeChannel === message.channel) {
          setLastSeenIds((current) => ({
            ...current,
            [message.channel]: message.id,
          }));
        }
      }),
    [activeChannel, isWorldChatRoute, sectId],
  );

  const latestMessage = previewMessages[0] ?? null;

  useEffect(() => {
    if (lastSeenPreviewMessageId || !latestMessage) {
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setLastSeenPreviewMessageId(latestMessage.id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [lastSeenPreviewMessageId, latestMessage]);

  useEffect(() => {
    if (
      !isWorldChatRoute ||
      !latestMessage ||
      lastSeenPreviewMessageId === latestMessage.id
    ) {
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setLastSeenPreviewMessageId(latestMessage.id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isWorldChatRoute, lastSeenPreviewMessageId, latestMessage]);

  useEffect(() => {
    const latest = feeds[activeChannel].messages[0];
    if (!isWorldChatRoute || !latest) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLastSeenIds((current) =>
        current[activeChannel] === latest.id
          ? current
          : { ...current, [activeChannel]: latest.id },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [activeChannel, feeds, isWorldChatRoute]);

  useEffect(() => {
    let wasOnline = false;
    return realtimeClient.subscribeStatus((status) => {
      const chat = status.channels['world-chat'];
      if (!chat.enabled || chat.state !== 'online') return;
      if (wasOnline && !reconnectRefreshPendingRef.current) {
        reconnectRefreshPendingRef.current = true;
        if (!isWorldChatRoute) {
          void fetchLatestPreview().finally(() => {
            reconnectRefreshPendingRef.current = false;
          });
          wasOnline = true;
          return;
        }
        const channels = CHANNELS.filter(
          (channel) => channel !== 'sect' || sectId,
        );
        void Promise.all(
          channels.map((channel) => fetchPage(channel, 1, false)),
        ).finally(() => {
          reconnectRefreshPendingRef.current = false;
        });
      }
      wasOnline = true;
    });
  }, [fetchLatestPreview, fetchPage, isWorldChatRoute, sectId]);

  const activeFeed = feeds[activeChannel];
  const unreadCounts = useMemo(
    () => ({
      world: countNewWorldChatMessages(
        feeds.world.messages,
        lastSeenIds.world,
      ),
      sect: countNewWorldChatMessages(feeds.sect.messages, lastSeenIds.sect),
      system: countNewWorldChatMessages(
        feeds.system.messages,
        lastSeenIds.system,
      ),
    }),
    [feeds, lastSeenIds],
  );
  const newMessageCount = isWorldChatRoute
    ? 0
    : countNewWorldChatMessages(
        previewMessages,
        lastSeenPreviewMessageId,
      );

  const loadMore = useCallback(async () => {
    if (!activeFeed.hasMore || activeFeed.loadingMore) return;
    await fetchPage(activeChannel, activeFeed.page + 1, true);
  }, [activeChannel, activeFeed, fetchPage]);

  const send = useCallback(
    async (
      body:
        | {
            messageType: 'text';
            textContent: string;
            payload: { text: string };
          }
        | {
            messageType: 'item_showcase';
            revision: SendWorldChatShowcaseInput['revision'];
            itemId: string;
            textContent?: string;
          },
    ) => {
      if (activeChannel === 'system' || (activeChannel === 'sect' && !sectId)) {
        return false;
      }
      setPosting(true);
      try {
        const endpoint =
          activeChannel === 'sect'
            ? '/api/sects/current/chat/messages'
            : '/api/world-chat/messages';
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || '发送失败');
        }
        const created = payload.data as WorldChatMessageDTO;
        setFeeds((current) => ({
          ...current,
          [created.channel]: {
            ...current[created.channel],
            messages: mergeWorldChatMessages(
              current[created.channel].messages,
              [created],
            ),
          },
        }));
        if (created.channel !== 'sect') {
          setPreviewMessages((current) =>
            mergeWorldChatMessages(current, [created]).slice(0, PAGE_SIZE),
          );
        }
        setLastSeenIds((current) => ({
          ...current,
          [created.channel]: created.id,
        }));
        pushToast({
          message:
            body.messageType === 'item_showcase' ? '已展示道具' : '已发出传音',
          tone: 'success',
        });
        return true;
      } catch (error) {
        pushToast({
          message: error instanceof Error ? error.message : '发送失败',
          tone: 'danger',
        });
        return false;
      } finally {
        setPosting(false);
      }
    },
    [activeChannel, pushToast, sectId],
  );

  const value = useMemo<WorldChatFeedModel>(
    () => ({
      messages: activeFeed.messages,
      latestMessage,
      newMessageCount,
      unreadCounts,
      loading: activeFeed.loading,
      loadingMore: activeFeed.loadingMore,
      hasMore: activeFeed.hasMore,
      posting,
      hasSect,
      isWorldChatRoute,
      activeChannel,
      setActiveChannel,
      loadMore,
      sendTextMessage: (text) =>
        send({
          messageType: 'text',
          textContent: text,
          payload: { text },
        }),
      sendShowcaseMessage: (input) =>
        send({
          messageType: 'item_showcase',
          revision: input.revision,
          itemId: input.itemId,
          textContent: input.textContent || undefined,
        }),
    }),
    [
      activeChannel,
      activeFeed,
      hasSect,
      isWorldChatRoute,
      latestMessage,
      loadMore,
      newMessageCount,
      posting,
      send,
      unreadCounts,
    ],
  );

  return (
    <WorldChatFeedContext.Provider value={value}>
      {children}
    </WorldChatFeedContext.Provider>
  );
}
