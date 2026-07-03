import Link from '@app/components/router/AppLink';
import { useWorldChatFeedModel } from './useWorldChatFeedModel';
import { getWorldChatMessageBody } from './worldChatSummary';

export function WorldChatPreviewBar() {
  const { latestMessage, newMessageCount, isWorldChatRoute } =
    useWorldChatFeedModel();

  if (isWorldChatRoute) {
    return null;
  }

  const previewBody = latestMessage
    ? getWorldChatMessageBody(latestMessage)
    : '暂无新声';
  const sender = latestMessage?.senderName ?? '万界频道';
  const channelLabel = latestMessage?.channel === 'system' ? '系统' : '世界';

  return (
    <div className="battle-dock border-battle-rule-strong border-t border-dashed">
      <div className="mx-auto max-w-5xl px-3 py-1.5 md:px-6">
        <Link
          href="/game/world-chat"
          className="hover:text-crimson flex w-full items-center gap-2 px-0 py-1.5 text-left transition"
        >
          <span aria-hidden="true" className="shrink-0 text-sm leading-none">
            🔔
          </span>
          <div className="min-w-0 flex-1 truncate text-sm leading-6">
            {latestMessage ? (
              <span className="text-battle-muted">{`[${channelLabel}] `}</span>
            ) : null}
            <span className="text-battle-muted">{sender}：</span>
            <span className="text-ink">{previewBody}</span>
          </div>
          {newMessageCount > 0 ? (
            <span className="bg-crimson text-bgpaper inline-flex min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[0.62rem] leading-4">
              {newMessageCount}
            </span>
          ) : null}
          <span className="text-battle-muted shrink-0 text-sm whitespace-nowrap">
            [查看]
          </span>
        </Link>
      </div>
    </div>
  );
}
