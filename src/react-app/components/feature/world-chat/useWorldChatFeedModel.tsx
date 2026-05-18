import { useInkUI } from '@app/components/providers/InkUIProvider';
import type {
  WorldChatMessageDTO,
  WorldChatShowcaseItemType,
} from '@shared/types/world-chat';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router';

const PAGE_SIZE = 20;
const POLL_INTERVAL_MS = 15 * 1000;

export interface SendWorldChatShowcaseInput {
  itemType: WorldChatShowcaseItemType;
  itemId: string;
  textContent?: string;
}

interface WorldChatFeedModel {
  messages: WorldChatMessageDTO[];
  latestMessage: WorldChatMessageDTO | null;
  newMessageCount: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  posting: boolean;
  isWorldChatRoute: boolean;
  loadMore: () => Promise<void>;
  sendTextMessage: (text: string) => Promise<boolean>;
  sendShowcaseMessage: (input: SendWorldChatShowcaseInput) => Promise<boolean>;
}

const WorldChatFeedContext = createContext<WorldChatFeedModel | null>(null);

export function mergeWorldChatMessages(
  base: WorldChatMessageDTO[],
  incoming: WorldChatMessageDTO[],
) {
  const seen = new Set<string>();
  const merged = [...incoming, ...base].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  return merged.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export function countNewWorldChatMessages(
  messages: WorldChatMessageDTO[],
  lastSeenMessageId: string | null,
) {
  if (!lastSeenMessageId || messages.length === 0) {
    return 0;
  }

  const seenIndex = messages.findIndex((message) => message.id === lastSeenMessageId);
  if (seenIndex <= 0) {
    return 0;
  }

  return seenIndex;
}

export function WorldChatFeedProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { pushToast } = useInkUI();
  const location = useLocation();
  const isWorldChatRoute = location.pathname === '/game/world-chat';
  const [messages, setMessages] = useState<WorldChatMessageDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [posting, setPosting] = useState(false);
  const [lastSeenMessageId, setLastSeenMessageId] = useState<string | null>(null);
  const initializedSeenRef = useRef(false);

  const latestMessage = messages[0] ?? null;

  const fetchPage = useCallback(
    async (targetPage: number, append: boolean) => {
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const res = await fetch(
          `/api/world-chat/messages?page=${targetPage}&pageSize=${PAGE_SIZE}`,
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
        const res = await fetch(
          `/api/world-chat/messages?page=1&pageSize=${PAGE_SIZE}`,
          { cache: 'no-store' },
        );
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || '获取世界传音失败');
        }

        if (cancelled) return;

        setMessages((data.data || []) as WorldChatMessageDTO[]);
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
  }, [pushToast]);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/world-chat/messages?page=1&pageSize=${PAGE_SIZE}`,
          { cache: 'no-store' },
        );
        const data = await res.json();
        if (!res.ok || !data.success) return;

        const latest = (data.data || []) as WorldChatMessageDTO[];
        setMessages((prev) => mergeWorldChatMessages(prev, latest));
      } catch (error) {
        console.error('轮询世界传音失败:', error);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (initializedSeenRef.current || !latestMessage) {
      return;
    }

    initializedSeenRef.current = true;
    setLastSeenMessageId(latestMessage.id);
  }, [latestMessage]);

  useEffect(() => {
    if (!latestMessage) {
      return;
    }

    if (isWorldChatRoute) {
      setLastSeenMessageId(latestMessage.id);
    }
  }, [isWorldChatRoute, latestMessage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) {
      return;
    }

    await fetchPage(page + 1, true);
  }, [fetchPage, hasMore, loadingMore, page]);

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
        setMessages((prev) => mergeWorldChatMessages(prev, [created]));
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
    [pushToast],
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
        setMessages((prev) => mergeWorldChatMessages(prev, [created]));
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
    [pushToast],
  );

  const value = useMemo<WorldChatFeedModel>(
    () => ({
      messages,
      latestMessage,
      newMessageCount: countNewWorldChatMessages(messages, lastSeenMessageId),
      loading,
      loadingMore,
      hasMore,
      posting,
      isWorldChatRoute,
      loadMore,
      sendTextMessage,
      sendShowcaseMessage,
    }),
    [
      hasMore,
      isWorldChatRoute,
      lastSeenMessageId,
      latestMessage,
      loadMore,
      loading,
      loadingMore,
      messages,
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

export function useWorldChatFeedModel() {
  const context = useContext(WorldChatFeedContext);

  if (!context) {
    throw new Error('useWorldChatFeedModel 必须在 WorldChatFeedProvider 内使用');
  }

  return context;
}
