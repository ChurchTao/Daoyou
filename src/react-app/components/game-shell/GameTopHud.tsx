import { useInkUI } from '@app/components/providers/InkUIProvider';
import Link from '@app/components/router/AppLink';
import { useQiState } from '@app/components/feature/cultivator/useQiState';
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
}: GameHudSnapshot['metrics'][number]) {
  const toneClass =
    tone === 'hp'
      ? 'bg-crimson'
      : tone === 'mp'
        ? 'bg-teal'
        : tone === 'progress'
          ? 'bg-ink'
          : 'bg-wood';

  return (
    <div className="min-w-0 space-y-0.5">
      <div className="flex items-center justify-between gap-1.5 text-[0.62rem] leading-3.5 md:gap-2 md:text-[0.74rem] md:leading-4">
        <span className="text-battle-muted shrink-0 tracking-[0.12em]">
          {label}
        </span>
        <span className="text-ink shrink-0 text-right font-mono text-[0.66rem] md:text-[0.8rem]">
          {display}
        </span>
      </div>
      <div className="bg-battle-faint h-[3px] min-w-0 overflow-hidden">
        <div
          className={`${toneClass} h-full`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function formatSpiritStones(value: number): string {
  if (value >= 50000) {
    return `${Math.floor(value / 10000)}万`;
  }
  return String(value);
}

function HudTag({
  label,
  value,
  tone = 'default',
  onClick,
}: {
  label: string;
  value: ReactNode;
  tone?: 'default' | 'qi' | 'wealth';
  onClick?: () => void;
}) {
  const className = cn(
    'border-ink/15 bg-bgpaper/70 inline-flex min-w-0 items-center gap-1.5 border border-dashed px-1.5 py-0.5 text-[0.68rem] leading-4 md:text-xs',
    tone === 'qi' && 'border-teal/35 text-teal',
    tone === 'wealth' && 'border-wood/35 text-wood',
    onClick && 'hover:border-crimson/45 hover:text-crimson transition-colors',
  );
  const content = (
    <>
      <span className="text-battle-muted shrink-0">{label}</span>
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

  const openQiInfo = () => {
    openDialog({
      title: '天地灵气',
      content: (
        <div className="space-y-3 text-sm leading-7">
          <p>
            天地灵气是进入秘境、闭关修行、突破与造物时消耗的行动力。
          </p>
          <div className="border-ink/10 bg-bgpaper/70 space-y-1 border border-dashed px-3 py-2">
            <p>
              当前灵气：{qiState ? `${qiState.current}/${qiState.max}` : qiError ? '暂不可查' : '汇聚中'}
            </p>
            <p>每日会按自然日恢复到 {QI_MAX}。</p>
            <p>
              恢复符箓可临时溢出到 {QI_OVERFLOW_MAX}，每日最多使用{' '}
              {QI_DAILY_RESTORE_ITEM_LIMIT} 次。
            </p>
          </div>
          <div className="text-ink-secondary space-y-1">
            <p>
              主要用途：秘境探索 {QI_ACTION_COSTS.dungeon_start}、突破{' '}
              {QI_ACTION_COSTS.breakthrough_attempt}、即兴炼丹{' '}
              {QI_ACTION_COSTS.alchemy_improvised}、丹方炼丹/造物{' '}
              {QI_ACTION_COSTS.alchemy_formula}。
            </p>
            <p>灵气不足时，需要等待自然恢复，或使用恢复灵气的符箓。</p>
          </div>
        </div>
      ),
      confirmLabel: null,
      cancelLabel: '知道了',
    });
  };

  return (
    <header className="border-ink/10 border-b border-dashed">
      <div className="mx-auto block w-full max-w-5xl px-2.5 py-2 text-left sm:px-3 md:px-6">
        <div className="grid grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)] gap-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-5">
          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 md:gap-4">
            <Link
              href="/game/cultivator"
              aria-label="查看角色"
              className="border-ink/12 bg-bgpaper/85 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-dashed sm:w-16 md:h-16"
            >
              <img
                src="/assets/daoyou_logo.png"
                alt=""
                className="h-10 w-10 object-contain md:h-12 md:w-12 -mt-0.5"
              />
            </Link>

            <div className="min-w-0 space-y-2 mt-2">
              <div className="flex min-w-0 items-end gap-1.5 md:gap-2.5">
                <Link
                  href="/game/cultivator"
                  className="font-heading min-w-0 truncate text-2xl leading-none transition-colors hover:text-crimson md:text-3xl"
                >
                  {snapshot.name}
                </Link>
                {snapshot.title ? (
                  <div className="text-crimson hidden text-xs md:inline-block md:text-sm">
                    <span className="truncate">「{snapshot.title}」</span>
                  </div>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-0.5 text-xs leading-3.5 md:gap-x-4 md:text-sm">
                <div className="bg-ink/5 border-ink/15 flex min-w-0 gap-2 rounded border border-dashed p-1">
                  <span className="text-ink truncate">
                    {snapshot.statusText}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="mb-1 flex min-w-0 flex-wrap items-center justify-end gap-1.5">
              <HudTag
                label="境界"
                value={`${snapshot.realm}${snapshot.realmStage}`}
              />
              <HudTag
                label="灵气"
                value={qiDisplay}
                tone="qi"
                onClick={openQiInfo}
              />
              <HudTag
                label="灵石"
                value={formatSpiritStones(snapshot.spiritStones)}
                tone="wealth"
              />
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 md:gap-x-4 md:gap-y-2">
              {snapshot.metrics.map(({ key, ...metric }) => (
                <HudMeter key={key} {...metric} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
