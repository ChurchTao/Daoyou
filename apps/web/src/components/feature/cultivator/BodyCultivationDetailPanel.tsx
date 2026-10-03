import { InkButton, InkNotice } from '@app/components/ui';
import { GameIcon } from '@app/components/ui/GameIcon';
import { cn } from '@app/lib/cn';
import {
  useCultivatorCondition,
  useCultivatorIdentity,
} from '@app/lib/resources/player';
import { getBodyCultivationSummary } from '@daoyou/shared/lib/bodyCultivation/summary';
import { getTrackProgressPercent } from './bodyCultivationProgress';
import { MarrowWashPanel } from './MarrowWashPanel';

import { RequirementLine } from './BodyCultivationPanels';

export function BodyCultivationDetailPanel() {
  const profile = useCultivatorIdentity();
  const condition = useCultivatorCondition();
  const identity = profile.data?.cultivator;
  const summary =
    identity && condition.data
      ? getBodyCultivationSummary(condition.data, {
          cultivatorRealm: identity.realm,
        })
      : null;
  const nextRealm = summary?.nextRealm ?? null;

  if (!identity || !condition.data || !summary) {
    return <InkNotice>尚无角色资料。</InkNotice>;
  }
  const breakthroughStatus = nextRealm
    ? nextRealm.canAttempt
      ? '可升阶'
      : '条件未齐'
    : '已圆满';

  return (
    <div className="space-y-8 text-sm leading-6">
      <section aria-labelledby="body-realm-heading">
        <h3 id="body-realm-heading" className="mb-3 text-base font-semibold">
          肉身阶位
        </h3>
        <div className="bg-ink/3 rounded-sm p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <GameIcon value="💪" className="size-9 text-3xl" />
              <div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="text-xl font-semibold">{summary.realm.label}</p>
                  <span
                    className={cn(
                      'text-xs',
                      nextRealm?.canAttempt
                        ? 'text-wood'
                        : 'text-ink-secondary',
                    )}
                  >
                    {breakthroughStatus}
                  </span>
                </div>
                <p className="text-ink-secondary mt-1 text-xs">
                  单轨上限{' '}
                  <span className="font-mono">
                    Lv.{summary.realm.softTrackCap}
                  </span>
                </p>
              </div>
            </div>
            <div className="ml-auto text-right">
              <p className="font-mono text-2xl font-semibold tracking-tight">
                Lv.{summary.totalLevel}
              </p>
              <p className="text-ink-secondary text-xs">五轨总等级</p>
            </div>
            {nextRealm?.canAttempt ? (
              <InkButton
                href="/game/body-cultivation/breakthrough"
                variant="primary"
                className="text-sm"
              >
                提升位阶
              </InkButton>
            ) : null}
          </div>
          <details className="mt-3">
            <summary className="text-ink-secondary min-h-11 cursor-pointer content-center text-xs focus-visible:outline-2 focus-visible:outline-offset-2">
              {nextRealm ? `进阶条件 · ${nextRealm.label}` : '炼体说明'}
            </summary>
            <div className="text-ink-secondary mt-2 space-y-2">
              <p>{summary.realm.unlockText}</p>
              {nextRealm ? (
                <>
                  <p>{nextRealm.unlockText}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {nextRealm.requirements.map((requirement) => (
                      <RequirementLine
                        key={requirement.label}
                        met={requirement.met}
                      >
                        {requirement.label}
                      </RequirementLine>
                    ))}
                  </div>
                </>
              ) : null}
              <p>
                炼体丹按药性方向提升对应轨道。肉身位阶控制单轨上限，五轨总等级与人物境界满足要求后，可无消耗、无失败地逐阶提升。
              </p>
            </div>
          </details>
        </div>
      </section>
      <section aria-labelledby="body-tracks-heading">
        <h3 id="body-tracks-heading" className="mb-3 text-base font-semibold">
          五轨修炼
        </h3>
        <div className="grid items-start gap-3 lg:grid-cols-2">
          {summary.tracks.map((track) => (
            <article key={track.key} className="bg-ink/3 rounded-sm p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="text-base font-semibold">{track.name}</h4>
                <span className="font-mono text-xl font-semibold tracking-tight">
                  Lv.{track.level}
                </span>
              </div>
              <p className="text-ink-secondary mt-1 text-xs">
                {track.shortDesc}
              </p>
              <div
                className="bg-ink/10 mt-3 h-1.5 overflow-hidden rounded-full"
                aria-hidden="true"
              >
                <div
                  className="bg-crimson/70 h-full rounded-full"
                  style={{ width: `${getTrackProgressPercent(track)}%` }}
                />
              </div>
              <p className="text-ink-secondary mt-2 text-xs">
                进度{' '}
                <span className="font-mono">
                  {track.progress} / {track.threshold}
                </span>
              </p>
            </article>
          ))}
        </div>
      </section>
      <MarrowWashPanel />
    </div>
  );
}
