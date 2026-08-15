import {
  InkBadge,
  InkButton,
  InkIdentifyCelebration,
} from '@app/components/ui';
import { getMaterialTypeInfo } from '@shared/lib/gameConceptDisplay';
import type { BlackMarketReveal } from '@shared/types/blackMarket';

const ratingTone: Record<BlackMarketReveal['rating'], string> = {
  血亏: 'text-crimson',
  小亏: 'text-crimson',
  公允: 'text-ink',
  小赚: 'text-ink',
  捡漏: 'text-gold',
  天降横财: 'text-gold',
};

export function BlackMarketRevealPanel({
  reveal,
  onBack,
}: {
  reveal: BlackMarketReveal;
  onBack(): void;
}) {
  const typeInfo = getMaterialTypeInfo(reveal.material.type);
  const celebrate = reveal.rating === '捡漏' || reveal.rating === '天降横财';

  return (
    <div className="flex min-h-[34rem] flex-col items-center justify-center px-5 py-10 text-center sm:px-10">
      {celebrate ? (
        <InkIdentifyCelebration rank={reveal.material.rank} />
      ) : null}
      <p className="text-ink-secondary text-sm tracking-[0.25em]">真品揭晓</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <h2 className="text-ink text-2xl font-normal sm:text-3xl">
          {reveal.material.name}
        </h2>
        <InkBadge tier={reveal.material.rank}>{typeInfo.label}</InkBadge>
      </div>
      <p className="text-ink-secondary mt-4 max-w-2xl text-sm leading-7 sm:text-base">
        {reveal.material.description || '灵光褪去伪装，真容终于显露。'}
      </p>

      {reveal.ownerBeliefSummary ? (
        <div className="border-ink/15 mt-7 w-full max-w-2xl border-l-2 px-4 py-3 text-left text-sm leading-7">
          <p className="text-ink-secondary text-xs tracking-[0.2em]">
            货主最初判断
          </p>
          <p className="mt-1">{reveal.ownerBeliefSummary}</p>
          {reveal.ownerFinalBeliefSummary ? (
            <>
              <p className="text-ink-secondary mt-3 text-xs tracking-[0.2em]">
                成交前判断
              </p>
              <p className="mt-1">{reveal.ownerFinalBeliefSummary}</p>
            </>
          ) : null}
        </div>
      ) : null}

      {reveal.clueReview?.length ? (
        <div className="mt-6 w-full max-w-2xl space-y-3 text-left">
          <p className="text-ink-secondary text-xs tracking-[0.2em]">线索回看</p>
          {reveal.clueReview.map((item, index) => (
            <div key={`${item.observation}-${index}`} className="bg-ink/[0.025] px-4 py-3 text-sm leading-7">
              <p>所见：{item.observation}</p>
              <p className="text-ink-secondary">货主判断：{item.ownerInterpretation}</p>
              <p className="text-gold">真相：{item.truth}</p>
            </div>
          ))}
        </div>
      ) : null}

      {reveal.claimReview?.length ? (
        <div className="mt-6 w-full max-w-2xl text-left text-sm leading-7">
          <p className="text-ink-secondary text-xs tracking-[0.2em]">
            摊前说法性质
          </p>
          {reveal.claimReview.map((item, index) => (
            <p key={`${item.claim}-${index}`} className="mt-2">
              “{item.claim}” · <span className="text-crimson">{item.verdict}</span>
            </p>
          ))}
        </div>
      ) : null}

      <div className="border-ink/15 mt-8 grid w-full max-w-xl gap-3 border-y py-5 text-sm sm:grid-cols-2 sm:text-base">
        <p>
          货主开价：
          <strong>{reveal.ownerAskPrice.toLocaleString()} 灵石</strong>
        </p>
        <p>
          成交价：<strong>{reveal.paidPrice.toLocaleString()} 灵石</strong>
        </p>
        <p>
          真实价值：<strong>{reveal.trueValue.toLocaleString()} 灵石</strong>
        </p>
        <p>属性：{reveal.material.element || '无明显五行'}</p>
        <p>价值比：{reveal.valueRatio.toFixed(2)} 倍</p>
      </div>

      <p className={`mt-7 text-3xl ${ratingTone[reveal.rating]}`}>
        【{reveal.rating}】
      </p>
      <p className="text-ink-secondary mt-4 text-sm leading-7">
        {reveal.epilogue}
      </p>
      <InkButton className="mt-8" onClick={onBack}>
        返回暗巷
      </InkButton>
    </div>
  );
}
