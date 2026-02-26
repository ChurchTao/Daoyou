'use client';

import { InkButton } from '@/components/ui/InkButton';
import { InkNotice } from '@/components/ui/InkNotice';
import type { WorldChatMessageDTO } from '@/types/world-chat';
import { useEffect, useState } from 'react';
import { WorldChatMessageItem } from './WorldChatMessageItem';

const PREVIEW_LIMIT = 3;
const POLL_INTERVAL_MS = 20 * 1000;

export function WorldChatPreview() {
  const [messages, setMessages] = useState<WorldChatMessageDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchMessages = async () => {
      try {
        const res = await fetch(
          `/api/world-chat/messages?limit=${PREVIEW_LIMIT}`,
          {
            cache: 'no-store',
          },
        );
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.success && Array.isArray(data.data)) {
          setMessages(data.data as WorldChatMessageDTO[]);
        }
      } catch (error) {
        if (cancelled) return;
        console.error('获取世界传音预览失败:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchMessages();
    const timer = setInterval(fetchMessages, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (loading) {
    return <InkNotice>世界传音加载中……</InkNotice>;
  }

  return (
    <div className="space-y-2">
      {messages.length > 0 ? (
        <div>
          {messages.map((message) => (
            <WorldChatMessageItem key={message.id} message={message} />
          ))}
        </div>
      ) : (
        <InkNotice>世界传音暂无消息，快来成为首位发言道友。</InkNotice>
      )}

      <InkButton href="/game/world-chat">查看全部传音 →</InkButton>
    </div>
  );
}
