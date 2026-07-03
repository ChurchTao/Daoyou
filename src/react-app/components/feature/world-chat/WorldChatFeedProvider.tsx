import { useInkUI } from '@app/components/providers/InkUIProvider';
import { realtimeClient } from '@app/lib/realtime/realtimeClient';
import type {
  WorldChatChannel,
  WorldChatMessageDTO,
} from '@shared/types/world-chat';
import {
  useCallback,
  useEffect,
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

export function WorldChatFeedProvider({ children }: { children: ReactNode }) {
  const { pushToast } = useInkUI();
  const location = useLocation();
  const isWorldChatRoute = location.pathname === '/game/world-chat';
  const [activeChannel, setActiveChannel] = useState<WorldChatChannel>('all');
  const [allMessages, setAllMessages] = useState<WorldChatMessageDTO[]>([]);
  const [messages, setMessages] = useState<WorldChatMessageDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [posting, setPosting] = useState(false);
  const [lastSeenMessageId, setLastSeenMessageId] = useState<string | null>(
    null,
  );
  const reconnectRefreshPendingRef = useRef(false);

  const latestMessage = allMessages[0] ?? null;
  const newMessageCount = isWorldChatRoute
    ? 0
    : countNewWorldChatMessages(allMessages, lastSeenMessageId);

  const fetchPage = useCallback(
    async (channel: WorldChatChannel, targetPage: number, append: boolean) => {
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const res = await fetch(
          `/api/world-chat/messages?channel=${channel}&page=${targetPage}&pageSize=${PAGE_SIZE}`,
          { cache: 'no-store' },
        );
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || '获取世界传音失败');
        }

        const nextMessages = (data.data || []) as WorldChatMessageDTO[];
        setMessages((prev) =>
          append ? [...prev, ...nextMessages] : nextMessages,
        );
        if (channel === 'all') {
          setAllMessages((prev) =>
            append ? mergeWorldChatMessages(prev, nextMessages) : nextMessages,
          );
        }
        setHasMore(Boolean(data.pagination?.hasMore));
        setPage(targetPage);
      } catch (error) {
        pushToast({
          message: error instanceof Error ? error.message : '获取世界传音失败',
          tone: 'danger',
        });
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [pushToast],
  );

  useEffect(() => {
    let cancelled = false;

    const loadInitialPage = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/world-chat/messages?channel=${activeChannel}&page=1&pageSize=${PAGE_SIZE}`,
          { cache: 'no-store' },
        );
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || '获取世界传音失败');
        }

        if (cancelled) return;

        const nextMessages = (data.data || []) as WorldChatMessageDTO[];
        setMessages(nextMessages);
        if (activeChannel === 'all') {
          setAllMessages(nextMessages);
        }
        setHasMore(Boolean(data.pagination?.hasMore));
        setPage(1);
      } catch (error) {
        if (cancelled) return;
        pushToast({
          message: error instanceof Error ? error.message : '获取世界传音失败',
          tone: 'danger',
        });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadInitialPage();

    return () => {
      cancelled = true;
    };
  }, [activeChannel, pushToast]);

  useEffect(() => {
    if (lastSeenMessageId || !latestMessage) {
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setLastSeenMessageId(latestMessage.id);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [lastSeenMessageId, latestMessage]);

  useEffect(() => {
    if (
      !isWorldChatRoute ||
      !latestMessage ||
      lastSeenMessageId === latestMessage.id
    ) {
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setLastSeenMessageId(latestMessage.id);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isWorldChatRoute, lastSeenMessageId, latestMessage]);

  useEffect(() => {
    realtimeClient.enableChannel('world-chat');
    return realtimeClient.subscribe('world-chat.message', (event) => {
      const message = event.payload;
      setAllMessages((prev) => mergeWorldChatMessages(prev, [message]));
      if (activeChannel === 'all' || message.channel === activeChannel) {
        setMessages((prev) => mergeWorldChatMessages(prev, [message]));
      }
    });
  }, [activeChannel]);

  useEffect(() => {
    let wasOnline = false;
    const unsubscribe = realtimeClient.subscribeStatus((status) => {
      const chat = status.channels['world-chat'];
      if (!chat.enabled) {
        return;
      }
      if (chat.state === 'online') {
        if (wasOnline && !reconnectRefreshPendingRef.current) {
          reconnectRefreshPendingRef.current = true;
          void fetchPage(activeChannel, 1, false).finally(() => {
            reconnectRefreshPendingRef.current = false;
          });
        }
        wasOnline = true;
      }
    });
    return () => {
      unsubscribe();
      realtimeClient.disableChannel('world-chat');
    };
  }, [activeChannel, fetchPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) {
      return;
    }

    await fetchPage(activeChannel, page + 1, true);
  }, [activeChannel, fetchPage, hasMore, loadingMore, page]);

  const sendTextMessage = useCallback(
    async (text: string) => {
      try {
        setPosting(true);
        const res = await fetch('/api/world-chat/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageType: 'text',
            textContent: text,
            payload: { text },
          }),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || '发送失败');
        }

        const created = data.data as WorldChatMessageDTO;
        setAllMessages((prev) => mergeWorldChatMessages(prev, [created]));
        if (activeChannel !== 'system') {
          setMessages((prev) => mergeWorldChatMessages(prev, [created]));
        }
        pushToast({ message: '已发出传音', tone: 'success' });
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
    [activeChannel, pushToast],
  );

  const sendShowcaseMessage = useCallback(
    async (input: SendWorldChatShowcaseInput) => {
      try {
        setPosting(true);
        const res = await fetch('/api/world-chat/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageType: 'item_showcase',
            itemType: input.itemType,
            itemId: input.itemId,
            textContent: input.textContent || undefined,
          }),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || '发送失败');
        }

        const created = data.data as WorldChatMessageDTO;
        setAllMessages((prev) => mergeWorldChatMessages(prev, [created]));
        if (activeChannel !== 'system') {
          setMessages((prev) => mergeWorldChatMessages(prev, [created]));
        }
        pushToast({ message: '已展示道具', tone: 'success' });
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
    [activeChannel, pushToast],
  );

  const value = useMemo<WorldChatFeedModel>(
    () => ({
      messages,
      latestMessage,
      newMessageCount,
      loading,
      loadingMore,
      hasMore,
      posting,
      isWorldChatRoute,
      activeChannel,
      setActiveChannel,
      loadMore,
      sendTextMessage,
      sendShowcaseMessage,
    }),
    [
      activeChannel,
      hasMore,
      isWorldChatRoute,
      latestMessage,
      loadMore,
      loading,
      loadingMore,
      messages,
      newMessageCount,
      posting,
      sendShowcaseMessage,
      sendTextMessage,
    ],
  );

  return (
    <WorldChatFeedContext.Provider value={value}>
      {children}
    </WorldChatFeedContext.Provider>
  );
}
