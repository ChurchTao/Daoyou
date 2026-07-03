import {
  ItemDetailModal,
  type ItemDetailPayload,
} from '@app/components/feature/items';
import type { Tier } from '@app/components/ui/InkBadge';
import { InkBadge, tierColorMap } from '@app/components/ui/InkBadge';
import { usePlayerStateView } from '@app/lib/player-state/selectors';
import { cn } from '@shared/lib/cn';
import type {
  ItemShowcaseSnapshotMap,
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
}

export function WorldChatMessageItem({ message }: WorldChatMessageItemProps) {
  const { cultivator } = usePlayerStateView();
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
              <span className="font-semibold">{message.senderName}</span>
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
          {message.messageType === 'duel_invite' ? (
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
