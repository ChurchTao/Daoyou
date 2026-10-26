import { BeastTradeDetails } from '@app/components/feature/beasts/BeastTradePreview';
import { CharacterCardTrigger } from '@app/components/feature/character-card/CharacterCardTrigger';
import { notifyHuntTeamChanged } from '@app/components/feature/hunts/huntTeamView';
import { huntRequest } from '@app/components/feature/hunts/useHunts';
import { itemPresentation } from '@app/components/feature/items/itemPresentation';
import { ItemPreview } from '@app/components/feature/items/ItemPreview';
import { InkModal } from '@app/components/layout';
import { GameIcon } from '@app/components/ui/GameIcon';
import { InkBadge } from '@app/components/ui/InkBadge';
import { InkButton } from '@app/components/ui/InkButton';
import { cn } from '@app/lib/cn';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import type { WorldChatMessageDTO } from '@daoyou/contracts/world-chat';
import { isInventoryShowcase } from '@daoyou/game-domain/items/catalog';
import { BeastTradePreviewSchema } from '@daoyou/game-rules/beasts/trade';
import { huntEventById, huntMapHref } from '@daoyou/game-rules/hunts';
import { memo, useMemo, useState } from 'react';
import { Link } from 'react-router';

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
});

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
  onReply?: (message: WorldChatMessageDTO) => void;
  onLocateReply?: (messageId: string) => void;
  onSelectRedPacket?: (packetId: string) => void;
  grouped?: boolean;
  highlighted?: boolean;
  claimed?: boolean;
}

export const WorldChatMessageItem = memo(function WorldChatMessageItem({
  message,
  onSelectFriend,
  onReply,
  onLocateReply,
  onSelectRedPacket,
  grouped = false,
  highlighted = false,
  claimed = false,
}: WorldChatMessageItemProps) {
  const cultivator = useCultivatorIdentity().data?.cultivator;
  const [detailOpen, setDetailOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joined, setJoined] = useState(false);
  const isSystemRumor =
    message.channel === 'system' ||
    (message.senderCultivatorId === null &&
      message.senderName === '修仙界传闻');
  const isOwn = message.senderCultivatorId === cultivator?.id;
  const senderTitle = isOwn ? cultivator?.title : message.senderTitle;
  const packet =
    message.messageType === 'red_packet' && 'packet' in message.payload
      ? message.payload.packet
      : null;

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
  const huntEventId =
    message.messageType === 'hunt_rumor' &&
    'eventId' in message.payload &&
    typeof message.payload.eventId === 'string'
      ? message.payload.eventId
      : undefined;
  const hunt =
    message.channel === 'system' && huntEventId
      ? huntEventById(huntEventId)
      : undefined;
  const recruit =
    message.messageType === 'hunt_recruit' &&
    'version' in message.payload &&
    message.payload.version === 1 &&
    'teamId' in message.payload &&
    typeof message.payload.teamId === 'string' &&
    'text' in message.payload &&
    typeof message.payload.text === 'string'
      ? { teamId: message.payload.teamId, text: message.payload.text }
      : null;
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
      <article
        data-message-id={message.id}
        aria-label={grouped ? `${message.senderName} 连续发言` : undefined}
        className={cn(
          'group min-w-0',
          grouped ? 'py-1' : 'py-1.5',
          highlighted && 'bg-teal/8',
        )}
      >
        <div className={cn('flex min-w-0 gap-2', isSystemRumor && 'pl-1')}>
          {grouped ? (
            <div className="relative w-7 shrink-0" aria-hidden="true">
              <span className="border-ink/20 absolute -top-2 left-3.5 h-5 w-2 border-b border-l" />
            </div>
          ) : !isSystemRumor ? (
            <div
              className="bg-ink/5 text-ink-secondary mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-sm"
              aria-hidden="true"
            >
              {Array.from(message.senderName)[0]}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            {!grouped ? (
              <div
                className="mb-0.5 flex min-h-6 items-center justify-between gap-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  {isSystemRumor ? (
                    <>
                      <span className="text-wood font-semibold">
                        {message.senderName}
                      </span>
                      <InkBadge tone="warning">「天道」</InkBadge>
                    </>
                  ) : (
                    <>
                      {message.senderCultivatorId ? (
                        <CharacterCardTrigger
                          id={message.senderCultivatorId}
                          name={message.senderName}
                          onSelectFriend={isOwn ? undefined : onSelectFriend}
                        >
                          <span className="flex min-w-0 items-baseline gap-1.5">
                            <span className="max-w-full shrink-0 truncate font-semibold">{message.senderName}</span>
                            {senderTitle ? <span className="min-w-0 truncate text-xs text-ink-secondary">「{senderTitle}」</span> : null}
                          </span>
                        </CharacterCardTrigger>
                      ) : (
                        <span
                          className="min-w-0 truncate font-semibold"
                          title={`${message.senderName} · ${message.senderRealm}${message.senderRealmStage}`}
                        >
                          {message.senderName}
                        </span>
                      )}
                      {isOwn ? (
                        <span className="text-teal text-xs">你</span>
                      ) : null}
                    </>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!isSystemRumor && onReply ? (
                    <InkButton
                      className="min-h-11 px-1 text-sm md:min-h-7 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
                      variant="secondary"
                      onClick={() => onReply(message)}
                    >
                      回复
                    </InkButton>
                  ) : null}
                  <time
                    className="text-ink-secondary shrink-0 font-mono text-xs"
                    dateTime={message.createdAt}
                    title={new Date(message.createdAt).toLocaleString('zh-CN')}
                  >
                    {timeFormatter.format(new Date(message.createdAt))}
                  </time>
                </div>
              </div>
            ) : null}
            {message.reply ? (
              <button
                type="button"
                disabled={message.reply.availability !== 'available'}
                className="border-teal bg-ink/4 text-ink-secondary mb-1.5 block w-full min-w-0 border-l-2 px-2.5 py-1.5 text-left text-sm disabled:cursor-default"
                onClick={() => onLocateReply?.(message.reply!.messageId)}
              >
                <span className="text-teal mr-2">
                  {message.reply.senderName}
                </span>
                <span className="block truncate">
                  {message.reply.availability === 'hidden'
                    ? '原消息不可见'
                    : message.reply.availability === 'expired'
                      ? '原消息已过期'
                      : message.reply.summary}
                </span>
              </button>
            ) : null}
            <div
              className={cn(
                'text-sm leading-6 break-words whitespace-pre-wrap',
                isOwn && !packet && 'bg-teal/5 px-2.5',
                isOwn && !packet && (grouped ? 'py-1' : 'py-1.5'),
              )}
              onClick={(event) => {
                if (
                  message.messageType === 'text' &&
                  !isSystemRumor &&
                  !grouped &&
                  !(
                    event.target instanceof Element &&
                    event.target.closest('a,button')
                  ) &&
                  !window.getSelection()?.toString()
                )
                  onReply?.(message);
              }}
            >
              {packet ? (
                <button
                  type="button"
                  className={cn(
                    'border-crimson/30 block w-full max-w-xs border text-left',
                    packet.status === 'open'
                      ? 'bg-crimson/90 text-paper'
                      : 'bg-crimson/8 text-ink-secondary',
                  )}
                  onClick={() => onSelectRedPacket?.(packet.id)}
                >
                  <div className="flex items-center gap-3 px-4 py-4">
                    <GameIcon value="🧧" className="text-3xl" />
                    <div className="min-w-0">
                      <p className="break-words">{packet.greeting}</p>
                      <p className="mt-1 text-sm opacity-80">
                        {packet.mode === 'equal' ? '等额' : '拼手气'} ·{' '}
                        <span className="font-mono">{packet.count}</span> 份
                      </p>
                    </div>
                  </div>
                  <div className="bg-ink/8 flex justify-between gap-2 px-4 py-2 text-sm">
                    <span>灵石红包</span>
                    <span>
                      {isOwn
                        ? '查看领取详情'
                        : claimed
                          ? '已领取 · 查看详情'
                          : packet.status === 'exhausted'
                            ? '已领完'
                            : packet.status === 'expired'
                              ? '已过期'
                              : '点击领取'}
                    </span>
                  </div>
                </button>
              ) : recruit ? (
                <span>
                  {recruit.text}{' '}
                  {message.senderCultivatorId &&
                  message.senderCultivatorId === cultivator?.id ? (
                    <Link
                      className="text-teal font-semibold underline"
                      to="/game/hunt-team"
                    >
                      加入队伍
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="text-teal font-semibold underline disabled:opacity-50"
                      disabled={joining || joined || !cultivator}
                      onClick={() => {
                        const actorId = cultivator?.id;
                        if (!actorId || joining) return;
                        setJoining(true);
                        setJoinError('');
                        void huntRequest(
                          `/api/hunts/teams/${recruit.teamId}/join`,
                          actorId,
                          {},
                        )
                          .then(() => {
                            setJoined(true);
                            notifyHuntTeamChanged();
                          })
                          .catch((cause: unknown) => {
                            setJoinError(
                              cause instanceof Error
                                ? cause.message
                                : '暂时未能加入',
                            );
                          })
                          .finally(() => setJoining(false));
                      }}
                    >
                      {joined ? '已加入' : joining ? '加入中' : '加入队伍'}
                    </button>
                  )}
                  {joinError ? (
                    <span className="text-crimson ml-2">{joinError}</span>
                  ) : null}
                </span>
              ) : hunt ? (
                <span>
                  {renderTextMessage(message)}{' '}
                  <Link
                    className="text-teal font-semibold underline"
                    to={huntMapHref(hunt)}
                  >
                    前往查看
                  </Link>
                </span>
              ) : message.messageType === 'combat_v6_replay' &&
                'version' in message.payload &&
                message.payload.version === 1 &&
                'shareCode' in message.payload &&
                typeof message.payload.shareCode === 'string' &&
                'sides' in message.payload &&
                Array.isArray(message.payload.sides) &&
                Array.isArray(message.payload.sides[0]) &&
                Array.isArray(message.payload.sides[1]) ? (
                <Link
                  className="border-ink/15 hover:border-teal block border border-dashed bg-white/55 px-3 py-2"
                  to={`/combat-replay/${message.payload.shareCode}`}
                >
                  <span className="text-teal font-semibold">
                    战斗回放 · {message.payload.sides[0].join('、')} 对阵{' '}
                    {message.payload.sides[1].join('、')}
                  </span>
                  <span className="text-ink-secondary ml-2 text-xs">
                    {message.payload.roundCount} 回合 · 点击查看
                  </span>
                  {message.payload.text ? (
                    <p className="mt-1">{message.payload.text}</p>
                  ) : null}
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
        </div>
      </article>
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
});
