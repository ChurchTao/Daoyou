import { GameLoadingState } from '@app/components/game-shell';
import { InkButton, InkNotice } from '@app/components/ui';
import type {
  BlackMarketNpcSummary,
  BlackMarketNpcStatus,
} from '@shared/types/blackMarket';

const OPENING_STEPS = [
  '你掀帘走近摊位……',
  '摊主揭开遮布一角……',
  '你从形制与损伤处开始观察……',
] as const;

function actionLabel(status: BlackMarketNpcStatus): string {
  if (status === 'completed') return '查看成交结果';
  if (status === 'in_progress') return '继续交谈';
  if (status === 'granted') return '重新靠近';
  return '走近摊位';
}

export function BlackMarketEntryPreview({
  npc,
  entryCost,
  currentQi,
  busy,
  openingStep,
  error,
  retryableMessage,
  onEnter,
  onBack,
}: {
  npc: BlackMarketNpcSummary;
  entryCost: 0 | 5;
  currentQi?: number;
  busy: boolean;
  openingStep?: number;
  error?: string;
  retryableMessage?: string;
  onEnter(): void;
  onBack(): void;
}) {
  const existingEntry = npc.status !== 'available';

  return (
    <section className="flex min-h-[34rem] flex-col px-5 py-6 sm:px-8 sm:py-8">
      <div>
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="text-ink-secondary hover:text-crimson focus-visible:outline-crimson text-sm transition-colors focus-visible:outline-2 disabled:opacity-50"
        >
          ← 再看看别的摊位
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center py-8 text-center">
        <span
          aria-hidden="true"
          className="text-ink-secondary text-3xl leading-none"
        >
          {npc.sigil}
        </span>
        <h2 className="text-ink mt-3 text-lg font-medium">{npc.name}</h2>
        <p className="text-ink-secondary mt-1 text-sm">{npc.identity}</p>
        <p className="text-ink-secondary mx-auto mt-5 max-w-lg text-sm leading-7 sm:text-base">
          {npc.responsibility}
        </p>

        {openingStep != null ? (
          <div className="mt-9">
            <GameLoadingState
              message={OPENING_STEPS[openingStep] ?? OPENING_STEPS[2]}
              variant="inline"
            />
          </div>
        ) : (
          <div className="mt-8 space-y-5">
            {retryableMessage ? <InkNotice>{retryableMessage}</InkNotice> : null}
            {error ? <InkNotice>{error}</InkNotice> : null}
            <div className="text-sm leading-7">
              {existingEntry ? (
                <p className="text-ink-secondary">今日的入场凭证仍然有效，不会再次收费。</p>
              ) : entryCost === 0 ? (
                <p className="text-teal">今日首次入场，不消耗天地灵气。</p>
              ) : (
                <div>
                  <p className="text-ink">
                    本次入场需消耗
                    <span className="text-teal mx-1">5点天地灵气</span>。
                  </p>
                  <p className="text-ink-secondary text-xs">
                    当前灵气：{currentQi ?? '读取中'}
                  </p>
                </div>
              )}
            </div>
            <InkButton variant="primary" onClick={onEnter} disabled={busy}>
              {actionLabel(npc.status)}
            </InkButton>
          </div>
        )}
      </div>
    </section>
  );
}
