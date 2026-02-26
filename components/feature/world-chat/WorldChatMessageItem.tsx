'use client';

import { ItemDetailModal } from '@/app/(game)/game/inventory/components/ItemDetailModal';
import type { Tier } from '@/components/ui/InkBadge';
import { InkBadge, tierColorMap } from '@/components/ui/InkBadge';
import { InkButton } from '@/components/ui/InkButton';
import { cn } from '@/lib/cn';
import type { Artifact, Consumable, Material } from '@/types/cultivator';
import type {
  ItemShowcaseSnapshotMap,
  WorldChatDuelInvitePayload,
  WorldChatItemShowcasePayload,
  WorldChatMessageDTO,
} from '@/types/world-chat';
import { useMemo, useState } from 'react';

const relativeTimeFormatter = new Intl.RelativeTimeFormat('zh-CN', {
  numeric: 'auto',
});

type WorldChatDetailItem = Artifact | Consumable | Material;

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

function isDuelInvitePayload(
  payload: WorldChatMessageDTO['payload'],
): payload is WorldChatDuelInvitePayload {
  return typeof payload === 'object' && payload !== null;
}

function parseShowcaseItem(payload: WorldChatItemShowcasePayload): {
  name: string;
  tier?: Tier;
  text?: string;
  detailItem: WorldChatDetailItem;
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
        id: item.id || payload.itemId,
        name: item.name,
        slot: item.slot,
        element: item.element,
        quality: item.quality,
        required_realm: item.required_realm,
        description: item.description,
        effects: item.effects,
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
        id: item.id || payload.itemId,
        name: item.name,
        type: item.type,
        rank: item.rank,
        element: item.element,
        description: item.description,
        quantity: item.quantity,
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
      id: item.id || payload.itemId,
      name: item.name,
      type: item.type,
      quality: item.quality,
      effects: item.effects,
      quantity: item.quantity,
      description: item.description,
    },
  };
}

interface WorldChatMessageItemProps {
  message: WorldChatMessageDTO;
  compact?: boolean;
}

export function WorldChatMessageItem({ message }: WorldChatMessageItemProps) {
  const [detailItem, setDetailItem] = useState<WorldChatDetailItem | null>(
    null,
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const isSystemRumor =
    message.messageType === 'duel_invite' &&
    message.senderCultivatorId === null;

  const showcaseData = useMemo(() => {
    if (message.messageType !== 'item_showcase') return null;
    if (!isItemShowcasePayload(message.payload)) return null;
    return parseShowcaseItem(message.payload);
  }, [message]);

  const duelInvitePath =
    message.messageType === 'duel_invite' &&
    isDuelInvitePayload(message.payload)
      ? (message.payload.routePath ?? '/game/bet-battle')
      : '/game/bet-battle';

  return (
    <>
      <div className="border-ink/10 border-b border-dashed py-2">
        <div className="mb-1 flex items-center gap-2">
          {isSystemRumor ? (
            <>
              <span className="font-semibold text-amber-700">
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
            <span className="inline-flex flex-wrap items-center gap-2">
              <span>{message.textContent || '赌战台有新战帖'}</span>
              <InkButton
                href={duelInvitePath}
                variant="secondary"
                className="px-2 py-0.5 text-xs"
              >
                前往应战
              </InkButton>
            </span>
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
      />
    </>
  );
}
