import { cn } from '@shared/lib/utils';
import { format } from 'd3-format';
import type { BreakthroughChancePresentation } from './breakthroughChancePresentation';

function formatPercent(value: number): string {
  return format('.1%')(value);
}

export function BreakthroughChanceDetails({
  presentation,
  className,
}: {
  presentation: BreakthroughChancePresentation;
  className?: string;
}) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-ink-secondary text-xs leading-5">综合基础率</p>
          <p className="text-ink font-mono font-semibold">
            {formatPercent(presentation.adjustedBaseChance)}
          </p>
        </div>
        <div>
          <p className="text-ink-secondary text-xs leading-5">最终成功率</p>
          <p className="text-emerald-800 font-mono font-semibold">
            {formatPercent(presentation.finalChance)}
          </p>
        </div>
      </div>

      {presentation.factors.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          {presentation.factors.map((factor) => (
            <span
              key={factor.key}
              className={cn(
                'border-ink/15 bg-bgpaper/70 inline-flex max-w-full items-center gap-1.5 border border-dashed px-2 py-1 text-xs leading-5',
                factor.tone === 'positive' &&
                  'border-emerald-700/25 text-emerald-800',
                factor.tone === 'warning' && 'border-wood/35 text-wood',
                factor.tone === 'neutral' && 'text-ink-secondary',
              )}
            >
              <span>{factor.label}</span>
              <span className="font-mono">{factor.value}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
