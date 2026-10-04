import { InkBadge } from '@app/components/ui';
import { cn } from '@app/lib/cn';
import {
  getBodyCultivationSummary,
  type BodyCultivationSummary,
  type BodyCultivationTrackSummary,
} from '@daoyou/game-rules/body-cultivation/progress';
import { type MarrowWashSummary } from '@daoyou/game-rules/body-cultivation/training';
import type { Cultivator } from '@daoyou/game-domain/character';
import { type ReactNode } from 'react';
import { getTrackProgressPercent } from './bodyCultivationProgress';

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

export function RequirementLine({
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
