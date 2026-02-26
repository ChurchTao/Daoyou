'use client';

import type { Tier } from '@/components/ui/InkBadge';
import { InkBadge } from '@/components/ui/InkBadge';
import type { WorldChatMessageDTO } from '@/types/world-chat';

const relativeTimeFormatter = new Intl.RelativeTimeFormat('zh-CN', {
  numeric: 'auto',
});

function formatRelativeTime(isoString: string): string {
  const time = new Date(isoString).getTime();
  if (Number.isNaN(time)) return '刚刚';
  const diffSeconds = Math.floor((Date.now() - time) / 1000);

  if (diffSeconds < 60) return '刚刚';
  if (diffSeconds < 3600) {
    return relativeTimeFormatter.format(
      -Math.floor(diffSeconds / 60),
      'minute',
    );
  }
  if (diffSeconds < 86400) {
    return relativeTimeFormatter.format(
      -Math.floor(diffSeconds / 3600),
      'hour',
    );
  }
  return relativeTimeFormatter.format(-Math.floor(diffSeconds / 86400), 'day');
}

function renderMessageContent(message: WorldChatMessageDTO): string {
  if (message.messageType === 'text') {
    const payloadText =
      typeof message.payload === 'object' &&
      message.payload &&
      'text' in message.payload &&
      typeof message.payload.text === 'string'
        ? message.payload.text
        : '';
    return message.textContent || payloadText;
  }
  if (message.messageType === 'duel_invite') {
    return '【赌斗邀请】该类型消息暂未开放展示';
  }
  return '【道具展示】该类型消息暂未开放展示';
}

interface WorldChatMessageItemProps {
  message: WorldChatMessageDTO;
  compact?: boolean;
}

export function WorldChatMessageItem({ message }: WorldChatMessageItemProps) {
  return (
    <div className="border-ink/10 border-b border-dashed py-2">
      <div className="mb-1 flex items-center gap-2">
        <span className="font-semibold">{message.senderName}</span>
        <InkBadge tier={message.senderRealm as Tier}>
          {message.senderRealmStage}
        </InkBadge>
        <span className="text-ink-secondary ml-auto text-xs">
          {formatRelativeTime(message.createdAt)}
        </span>
      </div>
      <p className="text-sm leading-6 break-all">
        {renderMessageContent(message)}
      </p>
    </div>
  );
}
