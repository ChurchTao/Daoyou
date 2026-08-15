import { NpcConversation } from '@app/components/feature/room';
import {
  InkButton,
  InkDetailDrawer,
  InkDialog,
  type InkDialogState,
  InkNotice,
} from '@app/components/ui';
import { normalizeBlackMarketPlayerBody } from '@shared/lib/blackMarketMessages';
import { getGameConceptInfo } from '@shared/lib/gameConceptDisplay';
import type {
  BlackMarketNpcSummary,
  BlackMarketSessionView,
} from '@shared/types/blackMarket';
import { useState } from 'react';

const SPIRIT_STONES = getGameConceptInfo('spirit_stones');

const quickMessages = [
  '仔细观察货物外观',
  '凝神感知货物灵气',
  '检查货物破损痕迹',
  '再凑近看看这物件的细节',
  '问问这货的来历',
  '问问他为何急着出手',
];

const observationTopicLabel = {
  appearance: '外观',
  aura: '气息',
  damage: '痕迹',
  origin: '来历',
  sale_reason: '出手缘由',
} as const;

export function BlackMarketConversation({
  npc,
  session,
  busy,
  error,
  notice,
  onSubmit,
  onCommit,
  onLeave,
}: {
  npc: BlackMarketNpcSummary;
  session: BlackMarketSessionView;
  busy: boolean;
  error?: string;
  notice?: string;
  onSubmit(message: string | undefined, offeredPrice?: number): void;
  onCommit(): Promise<void>;
  onLeave(): void;
}) {
  const [message, setMessage] = useState('');
  const [offeredPrice, setOfferedPrice] = useState('');
  const [showOffer, setShowOffer] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<InkDialogState | null>(
    null,
  );
  const dealReady = session.phase === 'deal_ready';
  const conversationClosed = !session.canInteract && !dealReady;
  const actionDisabled = busy || dealReady || conversationClosed;
  const composerFormId = `black-market-composer-${session.id}`;

  const confirmPurchase = () => {
    setConfirmDialog({
      id: `black-market-buy-${session.id}-${session.version}`,
      title: dealReady ? '就按这个价' : '暗巷成交',
      content: (
        <div className="space-y-3 text-sm leading-7">
          <p>
            以当前报价买下「{session.listing.disguisedName}
            」？成交后将当场揭晓真品。
          </p>
          <p className="text-gold font-semibold">
            将消耗：{SPIRIT_STONES.icon} {session.currentPrice.toLocaleString()}{' '}
            {SPIRIT_STONES.label}
          </p>
          <p className="text-ink-secondary">暗巷交易落子无悔。</p>
        </div>
      ),
      confirmLabel: dealReady ? '一手交钱，一手交货' : '成交揭晓',
      cancelLabel: '再想想',
      onConfirm: async () => {
        await onCommit();
      },
    });
  };

  const submitTurn = () => {
    const text = message.trim();
    const price = Number(offeredPrice);
    if (!text && (!offeredPrice || !Number.isSafeInteger(price))) return;
    onSubmit(text || undefined, offeredPrice ? price : undefined);
    setMessage('');
    setOfferedPrice('');
    setShowOffer(false);
    setComposerOpen(false);
  };

  const fillMessage = (text: string) => {
    setMessage((current) =>
      current.trim() ? `${current.trim()} ${text}` : text,
    );
  };

  const openComposer = (withOffer = false) => {
    if (withOffer) setShowOffer(true);
    setComposerOpen(true);
  };

  const fillAndOpenComposer = (text: string) => {
    fillMessage(text);
    setComposerOpen(true);
  };

  const inspectionObservationsByTurn = new Map(
    session.observations
      .filter(
        (observation) =>
          observation.source === 'inspection' &&
          observation.revealedAtTurn != null,
      )
      .map((observation) => [observation.revealedAtTurn!, observation]),
  );
  const messages = session.messages.map((entry) => {
    const observation =
      entry.role === 'npc' && entry.turn != null
        ? inspectionObservationsByTurn.get(entry.turn)
        : undefined;
    const after = observation ? (
        <div className="border-crimson/25 space-y-1.5 border-l pl-3 text-sm leading-6">
          <button
            type="button"
            disabled={actionDisabled}
            onClick={() =>
              fillAndOpenComposer(`关于“${observation.text}”，我想再问清楚。`)
            }
            className="text-ink-secondary hover:text-crimson focus-visible:outline-crimson block w-full text-left transition-colors focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-crimson">
              你看出·{observationTopicLabel[observation.topic]}
            </span>
            ：{observation.text}
          </button>
        </div>
      ) : undefined;
    return {
      id: entry.id,
      speaker: entry.role === 'npc' ? npc.name : undefined,
      body:
        entry.role === 'player'
          ? `你：${normalizeBlackMarketPlayerBody(entry.body)}`
          : entry.body,
      tone:
        entry.role === 'player'
          ? ('muted' as const)
          : entry.role === 'system'
            ? ('attention' as const)
            : ('normal' as const),
      gesture: entry.gesture,
      after,
      align: entry.role === 'player' ? ('end' as const) : ('start' as const),
    };
  });

  const openingObservations = (
    <div className="border-ink/15 space-y-1.5 border-b border-dashed pb-3 text-sm leading-6">
      <p className="text-ink-secondary text-xs tracking-[0.12em]">
        你在摊前先看见
      </p>
      {session.observations
        .filter((observation) => observation.source === 'surface')
        .map((observation) => (
          <button
            key={observation.id}
            type="button"
            disabled={actionDisabled}
            onClick={() =>
              fillAndOpenComposer(`关于“${observation.text}”，我想再问清楚。`)
            }
            className="text-ink-secondary hover:text-crimson focus-visible:outline-crimson block w-full text-left text-sm leading-6 transition-colors focus-visible:outline-2"
          >
            <span className="text-crimson/80">
              {observationTopicLabel[observation.topic]}
            </span>
            ：{observation.text}
          </button>
        ))}
      <div className="text-ink-secondary/80 flex flex-wrap gap-x-4 pt-1 text-xs">
        <span>
          {session.inspectionRemaining > 0
            ? `尚可细查 ${session.inspectionRemaining} 处`
            : '能查验的地方已经看遍'}
        </span>
        <span>
          {session.turnsRemaining > 0
            ? `尚可交谈 ${session.turnsRemaining} 次`
            : '今日能说的已经说尽'}
        </span>
      </div>
    </div>
  );

  const decisionFooter = (
    <div className="border-ink/15 space-y-3 border-t border-dashed pt-3">
      {notice ? <InkNotice>{notice}</InkNotice> : null}
      {dealReady ? (
        <InkNotice>摊主已经点头认下这个价。此刻只等你落定交易。</InkNotice>
      ) : null}
      {conversationClosed ? (
        <InkNotice>摊主已不愿多谈，你仍可按当前价拿下或离开。</InkNotice>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <span className="text-ink-secondary text-sm">
          当前报价：
          <strong className="text-gold font-normal">
            {session.currentPrice.toLocaleString()} 灵石
          </strong>
        </span>
        <InkButton onClick={confirmPurchase} disabled={busy} variant="primary">
          {dealReady ? '一手交钱，一手交货' : '按此价拿下'}
        </InkButton>
      </div>
    </div>
  );

  return (
    <>
      <NpcConversation
        actor={npc}
        messages={messages}
        busy={busy}
        error={error}
        transcriptIntro={openingObservations}
        containedTranscript
        density="compact"
        options={
          dealReady || conversationClosed
            ? [{ id: 'leave', label: '先离开摊位', tone: 'muted' }]
            : [
                { id: 'talk', label: '开口交谈', tone: 'primary' },
                {
                  id: 'offer',
                  label: '附价试探',
                  disabled: !session.canHaggle,
                },
                { id: 'leave', label: '先离开摊位', tone: 'muted' },
              ]
        }
        onSelectOption={(optionId) => {
          if (optionId === 'leave') onLeave();
          else openComposer(optionId === 'offer');
        }}
        footer={decisionFooter}
      />
      <InkDialog
        dialog={confirmDialog}
        onClose={() => setConfirmDialog(null)}
      />
      <InkDetailDrawer
        isOpen={composerOpen && !dealReady && session.canInteract}
        onClose={() => setComposerOpen(false)}
        title={`与${npc.name}交谈`}
        description={`当前要价 ${session.currentPrice.toLocaleString()} 灵石。快捷语只会填入说辞，不会直接发送。`}
        size="md"
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-secondary text-xs">
              {message.length}/240
            </span>
            <button
              type="submit"
              form={composerFormId}
              disabled={actionDisabled || (!message.trim() && !offeredPrice)}
              className="text-crimson focus-visible:outline-crimson hover:text-crimson/80 cursor-pointer px-1.5 py-1 font-sans text-[0.95rem] leading-[1.6] font-semibold tracking-[0.08em] whitespace-nowrap transition-colors focus-visible:outline-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              [开口]
            </button>
          </div>
        }
      >
        <form
          id={composerFormId}
          onSubmit={(event) => {
            event.preventDefault();
            submitTurn();
          }}
          className="space-y-5"
        >
          <div>
            <p className="text-ink-secondary mb-2 text-xs tracking-[0.12em]">
              快捷问法
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm leading-7">
              {quickMessages.map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => fillMessage(quick)}
                  className="text-ink-secondary hover:text-crimson focus-visible:outline-crimson cursor-pointer text-left transition-colors focus-visible:outline-2"
                >
                  ［{quick}］
                </button>
              ))}
            </div>
          </div>

          <div className="border-ink/20 bg-paper/40 focus-within:border-crimson/45 border">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={240}
              disabled={busy}
              rows={5}
              autoFocus
              className="w-full resize-none bg-transparent px-3 py-3 leading-7 outline-none"
              placeholder="说出你的观察、疑问或试探……"
              aria-label="跟摊主说点什么"
            />
          </div>

          {showOffer ? (
            <div className="border-ink/15 flex items-center gap-2 border-b border-dashed pb-2">
              <span className="text-ink-secondary shrink-0 text-sm">
                我的出价
              </span>
              <input
                type="number"
                min={1}
                max={2_000_000_000}
                value={offeredPrice}
                onChange={(event) => setOfferedPrice(event.target.value)}
                disabled={busy || !session.canHaggle}
                className="text-ink min-w-20 flex-1 bg-transparent px-2 py-1 text-right outline-none"
                placeholder="输入报价"
                aria-label="我的灵石出价"
              />
              <span className="text-ink-secondary shrink-0 text-sm">灵石</span>
              <InkButton
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowOffer(false);
                  setOfferedPrice('');
                }}
              >
                移除
              </InkButton>
            </div>
          ) : (
            <InkButton
              type="button"
              variant="secondary"
              disabled={busy || !session.canHaggle}
              onClick={() => setShowOffer(true)}
            >
              附上报价
            </InkButton>
          )}
        </form>
      </InkDetailDrawer>
    </>
  );
}
