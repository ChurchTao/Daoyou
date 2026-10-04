import { huntEventById, huntMapHref } from '@daoyou/game-rules/hunts';
import { BeastTradeDetails } from '@app/components/feature/beasts/BeastTradePreview';
import { itemPresentation } from '@app/components/feature/items/itemPresentation';
import { ItemPreview } from '@app/components/feature/items/ItemPreview';
import { InkModal } from '@app/components/layout';
import type { Tier } from '@app/components/ui/InkBadge';
import { InkBadge } from '@app/components/ui/InkBadge';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import { BeastTradePreviewSchema } from '@daoyou/game-rules/beasts/trade';
import { isInventoryShowcase } from '@daoyou/game-domain/items/catalog';
import { cn } from '@app/lib/cn';
import type {
  WorldChatMessageDTO,
} from '@daoyou/contracts/world-chat';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

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

function renderTextMessage(message: WorldChatMessageDTO): string {
  const payloadText =
    typeof message.payload === 'object' &&
    message.payload &&
    'text' in message.payload &&
    typeof message.payload.text === 'string'
      ? message.payload.text
      : '';
  return message.textContent || payloadText;
}

interface WorldChatMessageItemProps {
  message: WorldChatMessageDTO;
  compact?: boolean;
  onSelectFriend?: (cultivatorId: string) => void;
}

export function WorldChatMessageItem({
  message,
  onSelectFriend,
}: WorldChatMessageItemProps) {
  const cultivator = useCultivatorIdentity().data?.cultivator;
  const [detailOpen, setDetailOpen] = useState(false);
  const isSystemRumor =
    message.channel === 'system' ||
    (message.senderCultivatorId === null &&
      message.senderName === '修仙界传闻');

  const showcaseData = useMemo(() => {
    if (message.messageType !== 'item_showcase') return null;
    if (!isInventoryShowcase(message.payload)) return null;
    try {
      const presentation = itemPresentation(message.payload.snapshot);
      return {
        ...message.payload.snapshot,
        presentation,
        text: message.payload.text,
      };
    } catch {
      return null;
    }
  }, [message]);
  const hunt =
    message.channel === 'system' &&
    message.messageType === 'hunt_rumor' &&
    'eventId' in message.payload
      ? huntEventById(message.payload.eventId)
      : undefined;
  const beastShowcase =
    message.messageType === 'beast_showcase' &&
    'version' in message.payload &&
    message.payload.version === 1 &&
    'beast' in message.payload &&
    BeastTradePreviewSchema.safeParse(message.payload.beast).success
      ? (message.payload as Extract<
          WorldChatMessageDTO['payload'],
          { beast: unknown }
        >)
      : null;

  return (
    <>
      <div className="border-ink/10 border-b border-dashed py-2">
        <div className="mb-1 flex items-center gap-2">
          {isSystemRumor ? (
            <>
              <span className="text-wood font-semibold">
                {message.senderName}
              </span>
              <InkBadge tone="warning">「天道」</InkBadge>
            </>
          ) : (
            <>
              {message.senderCultivatorId &&
              message.senderCultivatorId !== cultivator?.id ? (
                <button
                  type="button"
                  className="hover:text-crimson cursor-pointer font-semibold underline-offset-2 hover:underline"
                  onClick={() => onSelectFriend?.(message.senderCultivatorId!)}
                  aria-label={`查看并收录道友 ${message.senderName}`}
                >
                  {message.senderName}
                </button>
              ) : (
                <span className="font-semibold">{message.senderName}</span>
              )}
              <InkBadge tier={message.senderRealm as Tier}>
                {message.senderRealmStage}
              </InkBadge>
            </>
          )}
          <span className="text-ink-secondary ml-auto text-xs">
            {formatRelativeTime(message.createdAt)}
          </span>
        </div>
        <div className="text-sm leading-6 break-all">
          {hunt ? (
            <span>
              {renderTextMessage(message)}{' '}
              <Link className="text-teal font-semibold underline" to={huntMapHref(hunt)}>
                前往查看
              </Link>
            </span>
          ) : message.messageType === 'combat_v6_replay' && 'version' in message.payload && message.payload.version === 1 && 'shareCode' in message.payload && typeof message.payload.shareCode === 'string' && 'sides' in message.payload && Array.isArray(message.payload.sides) && Array.isArray(message.payload.sides[0]) && Array.isArray(message.payload.sides[1]) ? (
            <Link className="border-ink/15 hover:border-teal block border border-dashed bg-white/55 px-3 py-2" to={`/combat-replay/${message.payload.shareCode}`}>
              <span className="text-teal font-semibold">战斗回放 · {message.payload.sides[0].join('、')} 对阵 {message.payload.sides[1].join('、')}</span>
              <span className="text-ink-secondary ml-2 text-xs">{message.payload.roundCount} 回合 · 点击查看</span>
              {message.payload.text ? <p className="mt-1">{message.payload.text}</p> : null}
            </Link>
          ) : beastShowcase ? (
            <span>
              <button
                type="button"
                className="text-teal cursor-pointer font-semibold hover:underline"
                onClick={() => setDetailOpen(true)}
              >
                ［{beastShowcase.beast.name}］
              </button>
              {beastShowcase.text ? ` ${beastShowcase.text}` : ''}
            </span>
          ) : message.messageType === 'item_showcase' && showcaseData ? (
            <span>
              <button
                type="button"
                className={cn(
                  'cursor-pointer font-semibold underline-offset-2 hover:underline',
                  showcaseData.presentation.color,
                )}
                onClick={() => {
                  setDetailOpen(true);
                }}
              >
                ［{showcaseData.name}］
              </button>
              {showcaseData.text ? ` ${showcaseData.text}` : ''}
            </span>
          ) : message.messageType === 'item_showcase' ? (
            renderTextMessage(message) || '道具详情暂不可查看'
          ) : (
            renderTextMessage(message)
          )}
        </div>
      </div>
      {showcaseData ? (
        <InkModal isOpen={detailOpen} onClose={() => setDetailOpen(false)}>
          <ItemPreview
            item={showcaseData}
            close={() => setDetailOpen(false)}
            context="发送时的物品状态"
          />
        </InkModal>
      ) : null}
      {beastShowcase ? (
        <InkModal
          isOpen={detailOpen}
          title={beastShowcase.beast.name}
          onClose={() => setDetailOpen(false)}
        >
          <BeastTradeDetails beast={beastShowcase.beast} tradeNotice={false} />
        </InkModal>
      ) : null}
    </>
  );
}
