import { RewardItemGrid } from '@app/components/feature/items/RewardItemGrid';
import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { SYSTEM_MAIL_HREF } from '@app/lib/social/mailNavigation';
import { getResourceTypeInfo } from '@daoyou/game-content/presentation/concepts';
import type { ContestCompletionReward } from '@daoyou/game-domain/alchemy/contest';
import { formatFullGameNumber } from '@daoyou/game-rules/presentation/numbers';
import { useEffect, useRef } from 'react';
import { ContestRounds } from './ContestTicket';
import type { ContestSession } from './presentation';

function RewardTotals({ reward }: { reward: ContestCompletionReward }) {
  const resources = [
    { type: 'cultivation_exp', value: reward.cultivationExp },
    { type: 'spirit_stones', value: reward.spiritStones },
    { type: 'comprehension_insight', value: reward.insight },
  ].filter(({ value }) => value > 0);
  if (!resources.length) return null;
  return (
    <dl className="flex flex-wrap gap-x-5 gap-y-2" aria-label="入账资源">
      {resources.map(({ type, value }) => {
        const { icon, label } = getResourceTypeInfo(type);
        return (
          <div key={type}>
            <dt className="text-ink-secondary flex items-center gap-1 text-sm">
              <GameIcon value={icon} /> {label}
            </dt>
            <dd className="text-teal font-mono font-semibold tracking-tight">
              +{formatFullGameNumber(value)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function ContestResult({
  session,
  settled,
  rankHref,
  showReceipt,
}: {
  session: ContestSession;
  settled: boolean;
  rankHref: string;
  showReceipt: (index: number) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const { standing, completionReward, attempts } = session;
  const items = completionReward?.items ?? [];

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="contest-scroll">
      <section
        className="contest-result"
        aria-labelledby="contest-result-title"
      >
        <header className="border-ink/20 space-y-2 border-b border-dashed pb-4">
          <h2 id="contest-result-title" ref={heading} tabIndex={-1}>
            本场成绩
          </h2>
          {standing ? (
            <>
              <p className="contest-result-score">
                <b className="font-mono">{standing.score}</b> 分
              </p>
              <p className="text-ink-secondary text-sm">
                第 <b className="font-mono">{standing.bestAttempt}</b>{' '}
                炉得分最高 · 节材{' '}
                <b className="font-mono">+{standing.materialPoints}</b> · 节气{' '}
                <b className="font-mono">+{standing.qiPoints}</b>
              </p>
            </>
          ) : (
            <p className="text-ink-secondary">
              本场没有丹药达标，不计入炼丹榜。
            </p>
          )}
        </header>

        {completionReward ? (
          <section
            aria-labelledby="contest-result-rewards"
            className="space-y-3"
          >
            <h3 id="contest-result-rewards" className="font-semibold">
              本场所得
            </h3>
            <RewardTotals reward={completionReward} />
            {items.length > 0 && (
              <div role="group" aria-label="所得道具">
                <RewardItemGrid grants={items} />
              </div>
            )}
          </section>
        ) : (
          standing && <p role="status">正在结算本场收益……</p>
        )}

        <div>
          <div className="weekly-activity-actions">
            {items.length > 0 && (
              <InkButton variant="primary" href={SYSTEM_MAIL_HREF}>
                查看传音
              </InkButton>
            )}
            <InkButton
              variant={items.length > 0 ? 'secondary' : 'primary'}
              href={rankHref}
            >
              查看炼丹榜
            </InkButton>
          </div>
          {standing && !settled && (
            <p className="text-ink-secondary mt-1 text-sm">
              有效成绩会更新炼丹榜，声望在封榜后发放。
            </p>
          )}
        </div>

        {attempts.length > 0 && (
          <details className="border-ink/15 space-y-2 border-t pt-2">
            <summary className="text-ink-secondary w-fit cursor-pointer py-2 text-sm">
              验丹记录
            </summary>
            <ContestRounds attempts={attempts} showReceipt={showReceipt} />
          </details>
        )}
      </section>
    </div>
  );
}
