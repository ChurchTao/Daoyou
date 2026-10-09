import { cn } from '@app/lib/cn';
import type { ReactNode } from 'react';
import type { GameHudSnapshot } from './useGameHudModel';

export function HudMeter({
  label,
  display,
  percent,
  tone,
  onClick,
}: GameHudSnapshot['metrics'][number] & { onClick?: () => void }) {
  const barPercent = Math.max(0, Math.min(percent, 100));
  const toneClass =
    tone === 'hp'
      ? 'bg-resource-hp'
      : tone === 'mp'
        ? 'bg-resource-mp'
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
          style={{ width: `${barPercent}%` }}
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

export function HudTag({
  className: extraClassName,
  label,
  value,
  tone = 'default',
  onClick,
}: {
  className?: string;
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
    extraClassName,
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

export function GameTopHudPlaceholder() {
  return (
    <header
      aria-busy="true"
      aria-label="角色状态加载中"
      className="border-ink/10 border-b border-dashed backdrop-blur-sm"
    >
      <div className="mx-auto block w-full max-w-5xl pt-[calc(env(safe-area-inset-top)+0.5rem)] pr-[max(env(safe-area-inset-right),0.625rem)] pb-2 pl-[max(env(safe-area-inset-left),0.625rem)] sm:pr-[max(env(safe-area-inset-right),0.75rem)] sm:pl-[max(env(safe-area-inset-left),0.75rem)] md:pr-[max(env(safe-area-inset-right),1.5rem)] md:pl-[max(env(safe-area-inset-left),1.5rem)]">
        <div className="grid min-w-0 grid-cols-[auto_minmax(3.75rem,0.55fr)_minmax(0,1fr)] items-center gap-2 md:grid-cols-[auto_minmax(8rem,0.44fr)_minmax(0,1fr)] md:gap-4">
          <div className="border-ink/12 bg-ink/5 h-11 w-11 shrink-0 rounded-full border border-dashed md:h-16 md:w-16" />
          <div className="bg-ink/8 h-5 w-3/4 max-w-28 md:h-7" />
          <div className="grid min-w-0 grid-cols-2 gap-x-2 gap-y-1.5 md:gap-x-4 md:gap-y-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="bg-ink/8 h-3 w-7" />
                  <span className="bg-ink/8 h-3 w-10" />
                </div>
                <div className="bg-battle-faint h-[3px]" />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex h-6 items-center gap-1.5 overflow-hidden">
          <div className="bg-ink/8 h-6 w-24 shrink-0" />
          <div className="bg-ink/8 h-6 w-20 shrink-0" />
          <div className="bg-ink/8 h-6 w-28 shrink-0" />
        </div>
      </div>
    </header>
  );
}
