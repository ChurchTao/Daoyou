import { useQiState } from '@app/components/feature/cultivator/useQiState';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import Link from '@app/components/router/AppLink';
import {
  BOTTLENECK_THRESHOLD,
  BREAKTHROUGH_MIN_PROGRESS,
  NORMAL_BREAKTHROUGH_THRESHOLD,
  PERFECT_BREAKTHROUGH_INSIGHT,
} from '@shared/config/cultivationTuning';
import {
  QI_ACTION_COSTS,
  QI_DAILY_RESTORE_ITEM_LIMIT,
  QI_MAX,
  QI_OVERFLOW_MAX,
} from '@shared/config/qiSystem';
import { cn } from '@shared/lib/cn';
import type { ReactNode } from 'react';
import type { GameHudSnapshot } from './useGameHudModel';

function HudMeter({
  label,
  display,
  percent,
  tone,
  onClick,
}: GameHudSnapshot['metrics'][number] & { onClick?: () => void }) {
  const toneClass =
    tone === 'hp'
      ? 'bg-crimson'
      : tone === 'mp'
        ? 'bg-teal'
        : tone === 'progress'
          ? 'bg-ink'
          : 'bg-wood';

  const className = cn(
    'min-w-0 space-y-1',
    onClick && 'hover:text-crimson text-left transition-colors',
  );
  const content = (
    <>
      <div className="flex min-w-0 items-center justify-between gap-1.5 text-[0.58rem] leading-3 md:gap-2 md:text-[0.74rem] md:leading-4">
        <span className="text-battle-muted shrink-0 tracking-[0.12em]">
          {label}
        </span>
        <span className="text-ink min-w-0 truncate text-right font-mono text-[0.58rem] md:text-[0.8rem]">
          {display}
        </span>
      </div>
      <div className="bg-battle-faint h-[3px] min-w-0 overflow-hidden">
        <div
          className={`${toneClass} h-full`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={cn(className, 'block w-full')}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function formatSpiritStones(value: number): string {
  if (value >= 50000) {
    return `${Math.floor(value / 10000)}万`;
  }
  return String(value);
}

function InfoTable({
  rows,
}: {
  rows: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <div className="border-ink/10 overflow-hidden border border-dashed">
      <table className="w-full border-collapse text-xs leading-5">
        <tbody className="divide-ink/10 divide-y">
          {rows.map((row) => (
            <tr key={row.label}>
              <th className="text-ink-secondary w-24 px-3 py-1.5 text-left font-medium">
                {row.label}
              </th>
              <td className="text-ink px-3 py-1.5 text-right">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HudTag({
  label,
  value,
  tone = 'default',
  onClick,
}: {
  label?: string;
  value: ReactNode;
  tone?: 'default' | 'qi' | 'wealth';
  onClick?: () => void;
}) {
  const className = cn(
    'border-ink/15 bg-bgpaper/70 inline-flex max-w-full min-w-0 items-center gap-1.5 border border-dashed px-1.5 py-0.5 text-[0.68rem] leading-4 md:text-xs',
    tone === 'qi' && 'border-teal/35 text-teal',
    tone === 'wealth' && 'border-wood/35 text-wood',
    onClick && 'hover:border-crimson/45 hover:text-crimson transition-colors',
  );
  const content = (
    <>
      {label && <span className="shrink-0 text-stone-500">{label}</span>}
      <span className="text-ink min-w-0 truncate font-mono">{value}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <span className={className}>{content}</span>;
}

export function GameTopHud({ snapshot }: { snapshot: GameHudSnapshot | null }) {
  const { openDialog } = useInkUI();
  const {
    state: qiState,
    loading: qiLoading,
    error: qiError,
  } = useQiState({
    cultivatorId: snapshot?.cultivatorId ?? '',
    autoRefresh: true,
    refreshInterval: 60_000,
  });

  if (!snapshot) return null;

  const qiDisplay = qiState
    ? `${qiState.current}/${qiState.max}`
    : qiLoading
      ? '汇聚中'
      : '--';
  const cultivationMetric = snapshot.metrics.find(
    (metric) => metric.key === 'cultivation',
  );
  const insightMetric = snapshot.metrics.find(
    (metric) => metric.key === 'insight',
  );

  const openRealmInfo = () => {
    openDialog({
      title: '境界',
      content: (
        <div className="space-y-3 text-sm leading-7">
          <p>
            境界代表当前道途层级，由大境界与小阶段共同组成。它会影响角色成长、玩法门槛、秘境匹配与突破目标。
          </p>
          <InfoTable
            rows={[
              {
                label: '当前境界',
                value: `${snapshot.realm}·${snapshot.realmStage}`,
              },
              {
                label: '提升方式',
                value: '在静室积累修为并尝试突破',
              },
              {
                label: '大境界',
                value: '通常还需完成破境卷宗',
              },
            ]}
          />
        </div>
      ),
      confirmLabel: null,
      cancelLabel: '知道了',
    });
  };

  const openCultivationInfo = () => {
    openDialog({
      title: '修为',
      content: (
        <div className="space-y-3 text-sm leading-7">
          <p>
            修为是当前境界内的积累进度。闭关、秘境、任务与部分丹药都可能带来修为增长，达到门槛后可在静室考虑冲关。
          </p>
          <InfoTable
            rows={[
              {
                label: '当前进度',
                value: cultivationMetric?.display ?? '--',
              },
              {
                label: '强行突破',
                value: `${BREAKTHROUGH_MIN_PROGRESS}% 起可尝试`,
              },
              {
                label: '常规突破',
                value: `${NORMAL_BREAKTHROUGH_THRESHOLD}% 起较稳`,
              },
              {
                label: '圆满突破',
                value: `100% 且感悟 ${PERFECT_BREAKTHROUGH_INSIGHT}+`,
              },
              {
                label: '瓶颈期',
                value: `${BOTTLENECK_THRESHOLD}% 后闭关收益会衰减`,
              },
            ]}
          />
        </div>
      ),
      confirmLabel: null,
      cancelLabel: '知道了',
    });
  };

  const openInsightInfo = () => {
    openDialog({
      title: '道心感悟',
      content: (
        <div className="space-y-3 text-sm leading-7">
          <p>
            道心感悟代表对功法、神通与天地法则的理解。它会参与突破火候，也会在推演功法、神通等玩法中作为关键消耗。
          </p>
          <InfoTable
            rows={[
              {
                label: '当前感悟',
                value: insightMetric?.display ?? '--',
              },
              {
                label: '圆满突破',
                value: `至少需要 ${PERFECT_BREAKTHROUGH_INSIGHT}`,
              },
              {
                label: '获取途径',
                value: '闭关顿悟、秘境历练、任务或丹药',
              },
              {
                label: '主要用途',
                value: '辅助突破，推演功法与神通',
              },
            ]}
          />
        </div>
      ),
      confirmLabel: null,
      cancelLabel: '知道了',
    });
  };

  const openQiInfo = () => {
    openDialog({
      title: '🍃 天地灵气',
      content: (
        <div className="space-y-3 text-sm leading-7">
          <p>进入秘境、闭关修行、突破与造物时需要消耗的一定的天地灵气。</p>
          <div className="border-ink/10 bg-bgpaper/70 space-y-1 border border-dashed px-3 py-2">
            <p>
              当前灵气：
              {qiState
                ? `${qiState.current}/${qiState.max}`
                : qiError
                  ? '暂不可查'
                  : '汇聚中'}
            </p>
            <p>每日会按自然日恢复到 {QI_MAX}。</p>
          </div>
          <p>
            恢复符箓可临时溢出到 {QI_OVERFLOW_MAX}，每日最多使用{' '}
            {QI_DAILY_RESTORE_ITEM_LIMIT} 次。
          </p>
          <div className="border-ink/10 overflow-hidden border border-dashed">
            <table className="w-full border-collapse text-xs leading-5">
              <thead className="bg-ink/5 text-ink">
                <tr>
                  <th className="px-3 py-1.5 text-left font-medium">玩法</th>
                  <th className="px-3 py-1.5 text-right font-medium">消耗</th>
                </tr>
              </thead>
              <tbody className="divide-ink/10 divide-y">
                <tr>
                  <td className="px-3 py-1.5">秘境探索</td>
                  <td className="text-ink px-3 py-1.5 text-right font-mono">
                    {QI_ACTION_COSTS.dungeon_start}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5">突破</td>
                  <td className="text-ink px-3 py-1.5 text-right font-mono">
                    {QI_ACTION_COSTS.breakthrough_attempt}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5">炼丹</td>
                  <td className="text-ink px-3 py-1.5 text-right font-mono">
                    {QI_ACTION_COSTS.alchemy_improvised}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5">炼器</td>
                  <td className="text-ink px-3 py-1.5 text-right font-mono">
                    {QI_ACTION_COSTS.creation_artifact}
                  </td>
                </tr>
                  <tr>
                  <td className="px-3 py-1.5">创造功法/神通</td>
                  <td className="text-ink px-3 py-1.5 text-right font-mono">
                    {QI_ACTION_COSTS.creation_gongfa}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ),
      confirmLabel: null,
      cancelLabel: '知道了',
    });
  };

  return (
    <header className="border-ink/10 sticky top-0 z-30 border-b border-dashed backdrop-blur-sm">
      <div className="mx-auto block w-full max-w-5xl px-2.5 py-2 text-left sm:px-3 md:px-6">
        <div className="grid min-w-0 grid-cols-[auto_minmax(3.75rem,0.55fr)_minmax(0,1fr)] items-center gap-2 md:grid-cols-[auto_minmax(8rem,0.44fr)_minmax(0,1fr)] md:gap-4">
          <Link
            href="/game/cultivator"
            aria-label="查看角色"
            className="border-ink/12 bg-bgpaper/85 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-dashed md:h-16 md:w-16"
          >
            <img
              src="/assets/daoyou_logo.png"
              alt=""
              className="-mt-0.5 h-9 w-9 object-contain md:h-12 md:w-12"
            />
          </Link>

          <div className="min-w-0">
            <div className="flex min-w-0 items-end gap-1.5 md:gap-2.5">
              <Link
                href="/game/cultivator"
                className="font-heading hover:text-crimson min-w-0 truncate text-xl leading-none transition-colors md:text-3xl"
              >
                {snapshot.name}
              </Link>
              {snapshot.title ? (
                <div className="text-crimson hidden min-w-0 text-xs md:inline-block md:text-sm">
                  <span className="block truncate">「{snapshot.title}」</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-2 gap-x-2 gap-y-1.5 md:grid-cols-2 md:gap-x-4 md:gap-y-2">
            {snapshot.metrics.map(({ key, ...metric }) => {
              const onClick =
                key === 'cultivation'
                  ? openCultivationInfo
                  : key === 'insight'
                    ? openInsightInfo
                    : undefined;

              return <HudMeter key={key} {...metric} onClick={onClick} />;
            })}
          </div>
        </div>

        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-1.5">
          <HudTag label="状态" value={snapshot.statusText} />
          <HudTag
            value={`${snapshot.realm}·${snapshot.realmStage}`}
            onClick={openRealmInfo}
          />
          <HudTag
            label="🍃 灵气"
            value={qiDisplay}
            tone="qi"
            onClick={openQiInfo}
          />
          <HudTag
            label="💰 灵石"
            value={formatSpiritStones(snapshot.spiritStones)}
            tone="wealth"
          />
        </div>
      </div>
    </header>
  );
}
