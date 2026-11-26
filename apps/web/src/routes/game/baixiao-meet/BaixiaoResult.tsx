import { BaixiaoScorecard } from '@app/components/feature/baixiao/BaixiaoScorecard';
import { baixiaoTime } from '@app/components/feature/baixiao/time';
import { RewardItemGrid } from '@app/components/feature/items/RewardItemGrid';
import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { cn } from '@app/lib/cn';
import { SYSTEM_MAIL_HREF } from '@app/lib/social/mailNavigation';
import { getResourceTypeInfo } from '@daoyou/game-content/presentation/concepts';
import type {
  BaixiaoSessionView,
  BaixiaoStatus,
} from '@daoyou/contracts/baixiao/meet';
import {
  BAIXIAO_MISS_LIMIT,
  BAIXIAO_QUESTION_COUNT,
} from '@daoyou/game-domain/baixiao/meet';
import { formatFullGameNumber } from '@daoyou/game-rules/presentation/numbers';
import { useEffect, useRef } from 'react';

export function BaixiaoResult({
  session,
  phase,
  mapHref,
  rankingHref,
}: {
  session: BaixiaoSessionView;
  phase: BaixiaoStatus['phase'];
  mapHref: string;
  rankingHref: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  const { earned, reward, score } = session;
  const cleared = session.finished === 'cleared';
  const eliminated = session.finished === 'eliminated';
  const title = cleared
    ? '二十五关已过'
    : eliminated
      ? '本场止步'
      : '作答时间已到';
  const resources = [
    { type: 'cultivation_exp', value: earned.cultivationExp },
    { type: 'spirit_stones', value: earned.spiritStones },
    { type: 'comprehension_insight', value: earned.insight },
  ].filter(({ value }) => value > 0);
  const items = reward?.items ?? [];

  return (
    <div className="baixiao-result-scroll">
      <section className="baixiao-result" aria-labelledby="baixiao-result-title">
        <header className="border-ink/20 flex items-center gap-4 border-b border-dashed pb-4 sm:gap-6 sm:pb-5">
          {reward && (
            <div
              id="baixiao-result-grade"
              className={cn(
                'font-heading grid size-16 shrink-0 -rotate-6 place-items-center border-4 text-4xl leading-none sm:size-24 sm:text-6xl',
                reward.grade === 'S'
                  ? 'border-crimson text-crimson'
                  : 'border-ink/60 text-ink/80',
              )}
            >
              <span className="sr-only">评级 </span>
              {reward.grade}
            </div>
          )}
          <div className="min-w-0">
            <h2
              ref={heading}
              tabIndex={-1}
              id="baixiao-result-title"
              aria-describedby={reward ? 'baixiao-result-grade' : undefined}
            >
              {title}
            </h2>
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <div className="flex items-baseline gap-1.5">
                <dt className="text-ink-secondary">答对</dt>
                <dd className="font-mono font-semibold tracking-tight">
                  {score.correct}/{BAIXIAO_QUESTION_COUNT}
                </dd>
              </div>
              <div className="flex items-baseline gap-1.5">
                <dt className="text-ink-secondary">总用时</dt>
                <dd className="font-mono font-semibold tracking-tight">
                  {baixiaoTime(score.totalMs)}
                </dd>
              </div>
            </dl>
            {eliminated && (
              <p className="text-ink-secondary mt-1.5 text-sm">
                累计 {BAIXIAO_MISS_LIMIT} 次失误。
              </p>
            )}
          </div>
        </header>

        <section className="space-y-2.5" aria-labelledby="baixiao-rewards-title">
          <h3 className="text-base font-semibold" id="baixiao-rewards-title">
            本场所得
          </h3>
          {resources.length > 0 && (
            <dl className="baixiao-earned">
              {resources.map(({ type, value }) => {
                const { icon, label } = getResourceTypeInfo(type);
                return (
                  <div
                    key={type}
                    className="bg-ink/5 border-ink/10 border px-2 py-1.5 sm:px-3 sm:py-2"
                  >
                    <dt className="text-ink-secondary flex items-center gap-1.5 text-sm">
                      <GameIcon value={icon} /> {label}
                    </dt>
                    <dd className="text-teal mt-0.5 font-mono font-semibold tracking-tight">
                      +{formatFullGameNumber(value)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
          {items.length > 0 && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-x-2">
                <p className="text-ink-secondary text-sm">
                  道具已随系统传音送达。
                </p>
                <InkButton
                  href={SYSTEM_MAIL_HREF}
                  variant="primary"
                  className="min-h-11"
                >
                  查看传音
                </InkButton>
              </div>
              <RewardItemGrid grants={items} />
            </div>
          )}
          {resources.length === 0 && items.length === 0 && (
            <p className="text-ink-secondary text-sm">本场未获得奖励。</p>
          )}
        </section>

        <details className="baixiao-result-details border-ink/15 border-t">
          <summary className="text-ink-secondary w-fit text-sm">
            计时与失误明细
          </summary>
          <BaixiaoScorecard score={score} showCorrect={false} showTotal={false} />
        </details>

        <footer className="space-y-1">
          <div className="weekly-activity-actions">
            <InkButton
              href={mapHref}
              variant={items.length ? 'secondary' : 'primary'}
            >
              返回舆图
            </InkButton>
            <InkButton href={rankingHref} variant="secondary">
              查看才子榜
            </InkButton>
          </div>
          {cleared && phase !== 'settled' && (
            <p className="text-ink-secondary text-sm">本期名次将在封榜后公布。</p>
          )}
        </footer>
      </section>
    </div>
  );
}
