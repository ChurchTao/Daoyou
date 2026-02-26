'use client';

import { useInkUI } from '@/components/providers/InkUIProvider';
import { InkButton } from '@/components/ui/InkButton';
import { InkInput } from '@/components/ui/InkInput';
import { InkNotice } from '@/components/ui/InkNotice';
import type { WorldChatMessageDTO } from '@/types/world-chat';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { WorldChatMessageItem } from './WorldChatMessageItem';

const PAGE_SIZE = 20;
const POLL_INTERVAL_MS = 15 * 1000;
const MAX_LENGTH = 100;

function countChars(input: string): number {
  return Array.from(input).length;
}

function mergeById(
  base: WorldChatMessageDTO[],
  incoming: WorldChatMessageDTO[],
): WorldChatMessageDTO[] {
  const seen = new Set<string>();
  const merged = [...incoming, ...base].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  return merged.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export function WorldChatPanel() {
  const { pushToast } = useInkUI();
  const [messages, setMessages] = useState<WorldChatMessageDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [posting, setPosting] = useState(false);
  const [input, setInput] = useState('');

  const charCount = useMemo(() => countChars(input), [input]);

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
    fetchPage(1, false);
  }, [fetchPage]);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/world-chat/messages?page=1&pageSize=20', {
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok || !data.success) return;
        const latest = (data.data || []) as WorldChatMessageDTO[];
        setMessages((prev) => mergeById(prev, latest));
      } catch (error) {
        console.error('轮询世界传音失败:', error);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore) return;
    await fetchPage(page + 1, true);
  };

  const handleSend = async () => {
    const text = input.trim();
    const length = countChars(text);
    if (length < 1 || length > MAX_LENGTH) {
      pushToast({ message: '消息长度需在 1-100 字之间', tone: 'warning' });
      return;
    }

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
      setInput('');
      setMessages((prev) => mergeById(prev, [created]));
      pushToast({ message: '已发出传音', tone: 'success' });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '发送失败',
        tone: 'danger',
      });
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        {loading ? (
          <InkNotice>世界传音加载中……</InkNotice>
        ) : messages.length === 0 ? (
          <InkNotice>暂时无人发言，快来抢占第一条。</InkNotice>
        ) : (
          <div>
            {messages.map((message) => (
              <WorldChatMessageItem key={message.id} message={message} />
            ))}
          </div>
        )}
      </div>

      {hasMore && !loading && (
        <div className="flex justify-center">
          <InkButton onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? '加载中...' : '加载更多'}
          </InkButton>
        </div>
      )}

      <div className="bg-paper sticky bottom-16 space-y-2 pt-3">
        <InkInput
          label="发送世界消息"
          value={input}
          multiline
          rows={3}
          placeholder="道友请留步，输入你想说的话..."
          onChange={(next) => {
            const limited = Array.from(next).slice(0, MAX_LENGTH).join('');
            setInput(limited);
          }}
          hint={`${charCount}/${MAX_LENGTH}`}
          disabled={posting}
        />
        <div className="flex justify-end">
          <InkButton
            variant="primary"
            onClick={handleSend}
            disabled={posting || charCount < 1}
          >
            {posting ? '传音中...' : '发送'}
          </InkButton>
        </div>
      </div>
    </div>
  );
}
