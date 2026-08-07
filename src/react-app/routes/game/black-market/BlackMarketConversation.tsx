import { NpcConversation } from '@app/components/feature/room';
import {
  InkButton,
  InkDialog,
  type InkDialogState,
  InkNotice,
} from '@app/components/ui';
import { normalizeBlackMarketPlayerBody } from '@shared/lib/blackMarketMessages';
import { getGameConceptInfo } from '@shared/lib/gameConceptDisplay';
import type {
  BlackMarketInspectionKind,
  BlackMarketNegotiationMood,
  BlackMarketNpcSummary,
  BlackMarketSessionView,
} from '@shared/types/blackMarket';
import { useMemo, useState } from 'react';

const SPIRIT_STONES = getGameConceptInfo('spirit_stones');

type InteractionMode = 'inspect' | 'question' | 'haggle';

const inspectOptions: Array<{
  kind: BlackMarketInspectionKind;
  label: string;
}> = [
  { kind: 'appearance', label: '观察外观' },
  { kind: 'aura', label: '感知灵气' },
  { kind: 'damage', label: '检查破损' },
];

const questionOptions: Array<{
  kind: BlackMarketInspectionKind;
  label: string;
}> = [
  { kind: 'origin', label: '问问来历' },
  { kind: 'sale_reason', label: '问为何出手' },
];

const moodCopy: Record<BlackMarketNegotiationMood, string> = {
  calm: '神色从容',
  guarded: '开始掂量你的来意',
  impatient: '已经有些不耐烦',
  agreed: '已经点头认价',
  closed: '已经把价咬死',
};

export function BlackMarketConversation({
  npc,
  session,
  busy,
  error,
  notice,
  onInspect,
  onQuestion,
  onHaggle,
  onCommit,
  onLeave,
}: {
  npc: BlackMarketNpcSummary;
  session: BlackMarketSessionView;
  busy: boolean;
  error?: string;
  notice?: string;
  onInspect(kind: BlackMarketInspectionKind): void;
  onQuestion(message: string): void;
  onHaggle(message: string | undefined, offeredPrice: number): void;
  onCommit(): Promise<void>;
  onLeave(): void;
}) {
  const [mode, setMode] = useState<InteractionMode>('inspect');
  const [question, setQuestion] = useState('');
  const [haggleMessage, setHaggleMessage] = useState('');
  const [offeredPrice, setOfferedPrice] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<InkDialogState | null>(
    null,
  );
  const revealedKinds = useMemo(
    () => new Set(session.revealedClues.map((clue) => clue.kind)),
    [session.revealedClues],
  );
  const inspectExhausted = !session.canInspect;
  const dealReady = session.phase === 'deal_ready';

  const messages = session.messages.map((message) => ({
    id: message.id,
    speaker: message.role === 'npc' ? npc.name : undefined,
    body:
      message.role === 'player'
        ? `你：${normalizeBlackMarketPlayerBody(message.body)}`
        : message.body,
    tone:
      message.role === 'player'
        ? ('muted' as const)
        : message.role === 'system'
          ? ('attention' as const)
          : ('normal' as const),
  }));

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

  const actionDisabled = busy || dealReady;

  return (
    <>
      <NpcConversation
        actor={npc}
        messages={messages}
        busy={busy}
        error={error}
      >
        <div className="space-y-5">
          <div className="border-ink/15 flex flex-wrap items-center justify-between gap-3 border-y py-3 text-sm">
            <span>{session.listing.disguisedName}</span>
            <strong className="text-gold">
              当前报价：{session.currentPrice.toLocaleString()} 灵石
            </strong>
            <span className="text-ink-secondary">
              摊主：{moodCopy[session.negotiationMood]}
            </span>
          </div>

          <p className="text-ink-secondary text-sm leading-7">
            {session.listing.description}
          </p>
          {notice ? <InkNotice>{notice}</InkNotice> : null}

          {dealReady ? (
            <InkNotice>
              摊主已经点头认下这个价。此刻再压价只会坏了规矩。
            </InkNotice>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <InkButton
                  onClick={() => setMode('inspect')}
                  disabled={busy || inspectExhausted}
                  variant={mode === 'inspect' ? 'primary' : 'secondary'}
                >
                  看货
                </InkButton>
                <InkButton
                  onClick={() => setMode('question')}
                  disabled={busy || inspectExhausted}
                  variant={mode === 'question' ? 'primary' : 'secondary'}
                >
                  试探
                </InkButton>
                <InkButton
                  onClick={() => setMode('haggle')}
                  disabled={busy || !session.canHaggle}
                  variant={mode === 'haggle' ? 'primary' : 'secondary'}
                >
                  谈价
                </InkButton>
              </div>

              {mode === 'inspect' ? (
                <div className="border-ink/15 bg-ink/[0.02] space-y-3 border-l-2 px-4 py-4">
                  <p className="text-ink-secondary text-sm">
                    先看看货，别急着信摊主的话。
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {inspectOptions.map((option) => (
                      <InkButton
                        key={option.kind}
                        onClick={() => onInspect(option.kind)}
                        disabled={
                          actionDisabled ||
                          inspectExhausted ||
                          revealedKinds.has(option.kind)
                        }
                      >
                        {option.label}
                      </InkButton>
                    ))}
                  </div>
                  {inspectExhausted ? (
                    <p className="text-ink-secondary text-sm">
                      再盯下去也看不出更多东西了。
                    </p>
                  ) : null}
                </div>
              ) : null}

              {mode === 'question' ? (
                <div className="border-ink/15 bg-ink/[0.02] space-y-3 border-l-2 px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    {questionOptions.map((option) => (
                      <InkButton
                        key={option.kind}
                        onClick={() => onInspect(option.kind)}
                        disabled={
                          actionDisabled ||
                          inspectExhausted ||
                          revealedKinds.has(option.kind)
                        }
                      >
                        {option.label}
                      </InkButton>
                    ))}
                  </div>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!question.trim()) return;
                      onQuestion(question.trim());
                      setQuestion('');
                    }}
                  >
                    <div className="border-ink/20 bg-paper/40 focus-within:border-crimson/45 flex items-center border">
                      <input
                        value={question}
                        onChange={(event) => setQuestion(event.target.value)}
                        maxLength={240}
                        disabled={actionDisabled || inspectExhausted}
                        className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none"
                        placeholder="跟他说点什么……"
                        aria-label="跟摊主说点什么"
                      />
                      <InkButton
                        type="submit"
                        disabled={actionDisabled || !question.trim()}
                      >
                        开口
                      </InkButton>
                    </div>
                  </form>
                </div>
              ) : null}

              {mode === 'haggle' ? (
                <div className="space-y-2">
                  {session.canHaggle ? (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        const price = Number(offeredPrice);
                        if (!Number.isSafeInteger(price) || price < 1) return;
                        onHaggle(haggleMessage.trim() || undefined, price);
                        setHaggleMessage('');
                        setOfferedPrice('');
                      }}
                      className="border-ink/20 bg-paper/40 focus-within:border-crimson/45 border"
                    >
                      <textarea
                        value={haggleMessage}
                        onChange={(event) =>
                          setHaggleMessage(event.target.value)
                        }
                        maxLength={240}
                        disabled={busy}
                        rows={2}
                        className="w-full resize-none bg-transparent px-3 py-3 outline-none"
                        placeholder="跟他说点什么……（也可以不说，直接开价）"
                        aria-label="还价时对摊主说的话"
                      />
                      <div className="border-ink/15 flex flex-wrap items-center gap-2 border-t px-3 py-2">
                        <span className="text-ink-secondary text-sm">
                          我的出价
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={2_000_000_000}
                          value={offeredPrice}
                          onChange={(event) =>
                            setOfferedPrice(event.target.value)
                          }
                          disabled={busy}
                          className="text-ink min-w-28 flex-1 bg-transparent px-2 py-1 text-right outline-none"
                          placeholder="输入灵石数"
                          aria-label="我的灵石出价"
                        />
                        <span className="text-ink-secondary text-sm">灵石</span>
                        <InkButton
                          type="submit"
                          disabled={busy || !offeredPrice}
                          variant="primary"
                        >
                          开口还价
                        </InkButton>
                      </div>
                    </form>
                  ) : (
                    <p className="text-ink-secondary text-sm leading-7">
                      摊主已经把价咬死，再压下去只会把人谈走。
                    </p>
                  )}
                </div>
              ) : null}
            </>
          )}

          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <InkButton onClick={onLeave} disabled={busy} variant="secondary">
              先离开摊位
            </InkButton>
            <InkButton
              onClick={confirmPurchase}
              disabled={busy}
              variant="primary"
            >
              {dealReady ? '一手交钱，一手交货' : '按当前价格拿下'}
            </InkButton>
          </div>
        </div>
      </NpcConversation>
      <InkDialog
        dialog={confirmDialog}
        onClose={() => setConfirmDialog(null)}
      />
    </>
  );
}
