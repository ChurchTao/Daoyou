import { InkBadge, InkButton, InkNotice } from '@app/components/ui';
import { GameIcon } from '@app/components/ui/GameIcon';
import {
  useCultivatorCondition,
  useCultivatorIdentity,
} from '@app/lib/resources/player';
import {
  getBodyCultivationSummary,
  type BodyCultivationSummary,
  type BodyCultivationTrackSummary,
} from '@shared/lib/bodyCultivation/summary';
import { cn } from '@shared/lib/cn';
import { type MarrowWashSummary } from '@shared/lib/marrowWash';
import type { Cultivator } from '@shared/types/cultivator';
import { type ReactNode } from 'react';
import { MarrowWashPanel } from './MarrowWashPanel';

function BodyMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  tone?: 'default' | 'success' | 'muted';
}) {
  return (
    <div className="min-w-0">
      <p className="text-ink-secondary text-[0.68rem] leading-5">{label}</p>
      <p
        className={cn(
          'truncate text-sm leading-6 font-semibold',
          tone === 'success'
            ? 'text-wood'
            : tone === 'muted'
              ? 'text-ink-secondary'
              : 'text-ink',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function RequirementLine({
  met,
  children,
}: {
  met: boolean;
  children: ReactNode;
}) {
  return (
    <span className={cn(met ? 'text-wood' : 'text-ink-secondary')}>
      {met ? '✓' : '·'} {children}
    </span>
  );
}

function getTrackProgressPercent(track: BodyCultivationTrackSummary): number {
  return Math.round(
    Math.max(0, Math.min(track.progress / track.threshold, 1)) * 100,
  );
}

function BodyCultivationOverviewCard({
  summary,
  nextRealm = summary.nextRealm,
  status,
  statusTone = 'default',
  action,
  children,
}: {
  summary: BodyCultivationSummary;
  nextRealm?: BodyCultivationSummary['nextRealm'];
  status?: string;
  statusTone?: 'default' | 'success' | 'muted';
  action?: ReactNode;
  children?: ReactNode;
}) {
  const nextRealmLabel = nextRealm?.label ?? '已至顶阶';

  return (
    <div className="border-ink/15 bg-bgpaper/75 overflow-hidden border border-dashed">
      <div className="flex flex-wrap items-start justify-between gap-3 px-3 py-3">
        <div className="min-w-0">
          <p className="text-ink-secondary text-xs leading-5">当前阶位</p>
          <p className="text-ink text-xl leading-8 font-semibold">
            {summary.realm.label}
          </p>
          <p className="text-ink-secondary text-xs leading-5">
            {summary.realm.unlockText}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <div className="border-ink/10 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-dashed px-3 py-3 md:grid-cols-4">
        <BodyMetric label="炼体等级" value={`Lv.${summary.totalLevel}`} />
        <BodyMetric
          label="单轨上限"
          value={`Lv.${summary.realm.softTrackCap}`}
        />
        <BodyMetric label="下一境界" value={nextRealmLabel} />
        <BodyMetric
          label="进阶状态"
          value={status ?? (nextRealm ? '条件未齐' : '已圆满')}
          tone={statusTone}
        />
      </div>

      {children ? (
        <div className="border-ink/10 border-t border-dashed px-3 py-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function BodyCultivationTrackCard({
  track,
  dense = false,
  showNextEffects = true,
}: {
  track: BodyCultivationTrackSummary;
  dense?: boolean;
  showNextEffects?: boolean;
}) {
  return (
    <div className="border-ink/15 bg-bgpaper/60 border border-dashed px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-ink text-sm font-semibold">{track.name}</h3>
          <p className="text-ink-secondary text-xs leading-5">
            {track.shortDesc}
          </p>
        </div>
        <InkBadge tone="default">{`Lv.${track.level}`}</InkBadge>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between gap-2 text-xs leading-5">
          <span className="text-ink-secondary">
            {track.progress} / {track.threshold}
          </span>
          <span className="text-ink-secondary">
            下个节点 Lv.{track.nextMilestoneLevel}
          </span>
        </div>
        <div className="bg-ink/10 mt-1 h-1.5 overflow-hidden">
          <div
            className="bg-crimson h-full"
            style={{ width: `${getTrackProgressPercent(track)}%` }}
          />
        </div>
      </div>

      <div
        className={cn(
          'mt-3 grid gap-3 text-xs leading-5',
          showNextEffects && !dense ? 'md:grid-cols-2' : 'grid-cols-1',
        )}
      >
        <div>
          <p className="text-ink mb-1 font-medium">当前加成</p>
          <div className="text-ink-secondary flex flex-wrap gap-x-3 gap-y-1">
            {track.currentEffects.map((effect) => (
              <span key={effect}>{effect}</span>
            ))}
          </div>
        </div>
        {showNextEffects && !dense ? (
          <div>
            <p className="text-ink mb-1 font-medium">下级变化</p>
            <div className="text-ink-secondary flex flex-wrap gap-x-3 gap-y-1">
              {track.nextLevelEffects.map((effect) => (
                <span key={effect}>{effect}</span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BodyCultivationTrackGrid({
  summary,
  dense = false,
  showNextEffects = true,
}: {
  summary: BodyCultivationSummary;
  dense?: boolean;
  showNextEffects?: boolean;
}) {
  return (
    <div className={cn('grid gap-3', dense && 'gap-2 md:grid-cols-2')}>
      {summary.tracks.map((track) => (
        <BodyCultivationTrackCard
          key={track.key}
          track={track}
          dense={dense}
          showNextEffects={showNextEffects}
        />
      ))}
    </div>
  );
}

export function BodyCultivationSummaryContent({
  summary,
  dense = false,
}: {
  summary: BodyCultivationSummary;
  dense?: boolean;
}) {
  return (
    <div className={cn('space-y-3', dense && 'space-y-2')}>
      <BodyCultivationOverviewCard
        summary={summary}
        status={summary.nextRealm ? '继续修炼' : '已圆满'}
        statusTone={summary.nextRealm ? 'default' : 'success'}
      />
      <BodyCultivationTrackGrid
        summary={summary}
        dense={dense}
        showNextEffects={!dense}
      />
    </div>
  );
}

export function MarrowWashSummaryContent({
  summary,
  action,
  unallocatedPoints,
}: {
  summary: MarrowWashSummary;
  action?: ReactNode;
  unallocatedPoints?: number;
}) {
  const progressPercent = Math.round(
    Math.max(0, Math.min(summary.progress / summary.threshold, 1)) * 100,
  );

  return (
    <div className="border-ink/15 bg-bgpaper/75 overflow-hidden border border-dashed">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-3 py-3">
        <div className="min-w-0">
          <p className="text-ink-secondary text-xs leading-5">当前洗髓</p>
          <p className="text-ink text-xl leading-8 font-semibold">
            Lv.{summary.level} · {summary.realmLabel}
          </p>
          <p className="text-ink-secondary text-xs leading-5">
            服用洗髓丹推进进度，升级沉淀为自由属性点。
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <div className="border-ink/10 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-dashed px-3 py-3 md:grid-cols-4">
        <BodyMetric label="当前上限" value={`Lv.${summary.levelCap}`} />
        <BodyMetric
          label="破限门槛"
          value={
            summary.nextBreakthroughLevel
              ? `Lv.${summary.nextBreakthroughLevel}`
              : '修为不足'
          }
        />
        <BodyMetric
          label="破限状态"
          value={summary.canBreakthrough ? '可破限' : '继续洗髓'}
          tone={summary.canBreakthrough ? 'success' : 'default'}
        />
        {typeof unallocatedPoints === 'number' ? (
          <BodyMetric label="自由属性点" value={unallocatedPoints} />
        ) : (
          <BodyMetric
            label="当前进度"
            value={`${summary.progress} / ${summary.threshold}`}
          />
        )}
      </div>

      <div className="border-ink/10 border-t border-dashed px-3 py-3">
        <div className="flex items-center justify-between gap-2 text-xs leading-5">
          <span className="text-ink-secondary">
            {summary.progress} / {summary.threshold}
          </span>
          <span className="text-ink-secondary">{progressPercent}%</span>
        </div>
        <div className="bg-ink/10 mt-1 h-1.5 overflow-hidden">
          <div
            className="bg-teal h-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

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

export function BodyCultivationInspectionSection({
  cultivator,
}: {
  cultivator: Pick<Cultivator, 'condition' | 'realm'>;
}) {
  const summary = getBodyCultivationSummary(cultivator.condition, {
    cultivatorRealm: cultivator.realm,
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="text-ink text-sm font-semibold">肉身炼体</h5>
        <InkBadge tone="default">
          {`${summary.realm.label} · 总 Lv.${summary.totalLevel}`}
        </InkBadge>
      </div>
      <BodyCultivationSummaryContent summary={summary} dense />
    </section>
  );
}
