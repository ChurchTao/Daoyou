import { EquipmentDetails } from '@app/components/feature/forging/EquipmentDetails';
import { ConsumableDetails } from '@app/components/feature/items/ConsumableDetails';
import { itemPresentation } from '@app/components/feature/items/itemPresentation';
import { InkModal } from '@app/components/layout';
import type { Tier } from '@app/components/ui/InkBadge';
import { InkBadge } from '@app/components/ui/InkBadge';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import { isInventoryShowcase } from '@shared/items/showcase';
import { cn } from '@shared/lib/cn';
import type {
  WorldChatBattleShowcasePayload,
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
    <div className="border-ink/15 mt-1 border border-dashed bg-white/55 px-3 py-2">
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
        <span className="text-ink">旧版战报已停用</span>
      </div>
      {payload.text ? (
        <p className="text-ink border-ink/10 mt-1.5 border-t border-dashed pt-1.5 text-sm leading-6 break-all">
          {payload.text}
        </p>
      ) : null}
    </div>
  );
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
    const presentation = itemPresentation(message.payload.snapshot);
    if (!presentation) return null;
    return {
      ...message.payload.snapshot,
      presentation,
      text: message.payload.text,
    };
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
          {message.messageType === 'battle_showcase' && battleShowcase ? (
            <BattleShowcaseCard payload={battleShowcase} />
          ) : message.messageType === 'battle_showcase' ? (
            '旧版战报已停用'
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
            `旧版道具展示已停用 ${renderTextMessage(message)}`
          ) : (
            renderTextMessage(message)
          )}
        </div>
      </div>
      {showcaseData ? (
        <InkModal
          isOpen={detailOpen}
          onClose={() => setDetailOpen(false)}
          title={showcaseData.name}
        >
          <div className="space-y-3 text-sm">
            <p className="text-ink-secondary">
              发送时的物品状态 · 数量{' '}
              <span className="font-mono">{showcaseData.quantity}</span>
            </p>
            <p className={showcaseData.presentation.color}>
              {showcaseData.presentation.type} ·{' '}
              {showcaseData.presentation.tier}
            </p>
            {showcaseData.definitionId === 'equipment.v6' ? (
              <EquipmentDetails data={showcaseData.instanceData} />
            ) : showcaseData.definitionId === 'consumable.v1' ? (
              <ConsumableDetails
                data={showcaseData.instanceData}
                quantity={showcaseData.quantity}
              />
            ) : (
              <p className="whitespace-pre-line">
                {showcaseData.presentation.description}
              </p>
            )}
          </div>
        </InkModal>
      ) : null}
    </>
  );
}
