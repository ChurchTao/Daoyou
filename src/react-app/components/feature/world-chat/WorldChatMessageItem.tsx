import {
  ItemDetailModal,
  type ItemDetailPayload,
} from '@app/components/feature/items';
import Link from '@app/components/router/AppLink';
import type { Tier } from '@app/components/ui/InkBadge';
import { InkBadge, tierColorMap } from '@app/components/ui/InkBadge';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import { cn } from '@shared/lib/cn';
import type {
  ItemShowcaseSnapshotMap,
  WorldChatBattleShowcasePayload,
  WorldChatItemShowcasePayload,
  WorldChatMessageDTO,
} from '@shared/types/world-chat';
import { useMemo, useState } from 'react';

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

function isItemShowcasePayload(
  payload: WorldChatMessageDTO['payload'],
): payload is WorldChatItemShowcasePayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'itemType' in payload &&
    'itemId' in payload &&
    'snapshot' in payload &&
    typeof payload.itemType === 'string' &&
    typeof payload.itemId === 'string'
  );
}

function isBattleShowcasePayload(
  payload: WorldChatMessageDTO['payload'],
): payload is WorldChatBattleShowcasePayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'shareCode' in payload &&
    'winner' in payload &&
    'loser' in payload &&
    'turns' in payload &&
    typeof payload.shareCode === 'string' &&
    typeof payload.winner === 'object' &&
    payload.winner !== null &&
    typeof payload.winner.name === 'string' &&
    typeof payload.loser === 'object' &&
    payload.loser !== null &&
    typeof payload.loser.name === 'string' &&
    typeof payload.turns === 'number'
  );
}

function BattleShowcaseCard({
  payload,
}: {
  payload: WorldChatBattleShowcasePayload;
}) {
  return (
    <Link
      href={`/battle-replay/${payload.shareCode}`}
      className="border-ink/15 hover:border-crimson/35 mt-1 block border border-dashed bg-white/55 px-3 py-2 no-underline transition hover:bg-white/80"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-teal min-w-0 flex-1 truncate font-semibold">
          {payload.winner.name}
        </span>
        <span className="text-ink-secondary shrink-0 text-xs">胜</span>
        <span className="text-crimson min-w-0 flex-1 truncate text-right">
          {payload.loser.name}
        </span>
      </div>
      <div className="text-ink-secondary mt-1 flex items-center justify-between gap-3 text-xs">
        <span>鏖战 {payload.turns} 回</span>
        <span className="text-ink">观看战谱 →</span>
      </div>
      {payload.text ? (
        <p className="text-ink border-ink/10 mt-1.5 border-t border-dashed pt-1.5 text-sm leading-6 break-all">
          {payload.text}
        </p>
      ) : null}
    </Link>
  );
}

function parseShowcaseItem(payload: WorldChatItemShowcasePayload): {
  name: string;
  tier?: Tier;
  text?: string;
  detailItem: ItemDetailPayload;
} | null {
  if (!payload.snapshot || typeof payload.snapshot !== 'object') {
    return null;
  }

  if (payload.itemType === 'artifact') {
    const item = payload.snapshot as ItemShowcaseSnapshotMap['artifact'];
    if (
      typeof item.name !== 'string' ||
      typeof item.slot !== 'string' ||
      typeof item.element !== 'string'
    ) {
      return null;
    }
    return {
      name: item.name,
      tier: item.quality as Tier | undefined,
      text: payload.text,
      detailItem: {
        kind: 'artifact',
        item: {
          id: item.id || payload.itemId,
          name: item.name,
          slot: item.slot,
          element: item.element,
          quality: item.quality,
          description: item.description,
          productModel: item.productModel,
        },
      },
    };
  }

  if (payload.itemType === 'material') {
    const item = payload.snapshot as ItemShowcaseSnapshotMap['material'];
    if (
      typeof item.name !== 'string' ||
      typeof item.type !== 'string' ||
      typeof item.rank !== 'string' ||
      typeof item.quantity !== 'number'
    ) {
      return null;
    }
    return {
      name: item.name,
      tier: item.rank as Tier,
      text: payload.text,
      detailItem: {
        kind: 'material',
        item: {
          id: item.id || payload.itemId,
          name: item.name,
          type: item.type,
          rank: item.rank,
          element: item.element,
          description: item.description,
          quantity: item.quantity,
        },
      },
    };
  }

  if (payload.itemType === 'skill') {
    const item = payload.snapshot as ItemShowcaseSnapshotMap['skill'];
    if (typeof item.name !== 'string') {
      return null;
    }
    return {
      name: item.name,
      tier: item.quality as Tier | undefined,
      text: payload.text,
      detailItem: {
        kind: 'skill',
        item: {
          id: item.id || payload.itemId,
          name: item.name,
          element: item.element,
          quality: item.quality,
          description: item.description ?? undefined,
          score: item.score,
          productModel: item.productModel,
        } as ItemDetailPayload['item'],
      } as ItemDetailPayload,
    };
  }

  if (payload.itemType === 'gongfa') {
    const item = payload.snapshot as ItemShowcaseSnapshotMap['gongfa'];
    if (typeof item.name !== 'string') {
      return null;
    }
    return {
      name: item.name,
      tier: item.quality as Tier | undefined,
      text: payload.text,
      detailItem: {
        kind: 'gongfa',
        item: {
          id: item.id || payload.itemId,
          name: item.name,
          element: item.element ?? undefined,
          quality: item.quality ?? undefined,
          description: item.description ?? undefined,
          score: item.score,
          productModel: item.productModel,
        },
      },
    };
  }

  const item = payload.snapshot as ItemShowcaseSnapshotMap['consumable'];
  if (
    typeof item.name !== 'string' ||
    typeof item.type !== 'string' ||
    typeof item.quantity !== 'number'
  ) {
    return null;
  }
  return {
    name: item.name,
    tier: item.quality as Tier | undefined,
    text: payload.text,
    detailItem: {
      kind: 'consumable',
      item: {
        id: item.id || payload.itemId,
        name: item.name,
        type: item.type,
        quality: item.quality,
        quantity: item.quantity,
        description: item.description,
        spec: item.spec,
      },
    },
  };
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
  const [detailItem, setDetailItem] = useState<ItemDetailPayload | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const isSystemRumor =
    message.channel === 'system' ||
    (message.senderCultivatorId === null &&
      message.senderName === '修仙界传闻');

  const showcaseData = useMemo(() => {
    if (message.messageType !== 'item_showcase') return null;
    if (!isItemShowcasePayload(message.payload)) return null;
    return parseShowcaseItem(message.payload);
  }, [message]);
  const battleShowcase =
    message.messageType === 'battle_showcase' &&
    isBattleShowcasePayload(message.payload)
      ? message.payload
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
                  className="cursor-pointer font-semibold underline-offset-2 hover:text-crimson hover:underline"
                  onClick={() =>
                    onSelectFriend?.(message.senderCultivatorId!)
                  }
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
          {message.messageType === 'battle_showcase' && battleShowcase ? (
            <BattleShowcaseCard payload={battleShowcase} />
          ) : message.messageType === 'battle_showcase' ? (
            '【战谱展示】'
          ) : message.messageType === 'duel_invite' ? (
            message.textContent || '赌战台有新战帖'
          ) : message.messageType === 'item_showcase' && showcaseData ? (
            <span>
              <button
                type="button"
                className={cn(
                  'cursor-pointer font-semibold underline-offset-2 hover:underline',
                  showcaseData.tier
                    ? tierColorMap[showcaseData.tier]
                    : 'text-ink',
                )}
                onClick={() => {
                  setDetailItem(showcaseData.detailItem);
                  setDetailOpen(true);
                }}
              >
                ［{showcaseData.name}］
              </button>
              {showcaseData.text ? ` ${showcaseData.text}` : ''}
            </span>
          ) : message.messageType === 'item_showcase' ? (
            '【道具展示】'
          ) : (
            renderTextMessage(message)
          )}
        </div>
      </div>
      <ItemDetailModal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        item={detailItem}
        viewerRealm={cultivator?.realm}
      />
    </>
  );
}
