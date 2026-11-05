import { cn } from '@app/lib/cn';
import type { ExorcismRunState } from '@daoyou/game-domain/dungeon/exorcism';
import { EXORCISM_STAGES, ratioPercent } from './exorcismView';

const METER_COLOR = {
  hp: 'bg-[var(--color-resource-hp)]',
  mp: 'bg-[var(--color-resource-mp)]',
} as const;

export function ExorcismMeter({
  label,
  current,
  max,
  tone,
  preview,
}: {
  label: string;
  current: number;
  max: number;
  tone: 'hp' | 'mp';
  /** 补给页预览调息后的数值。 */
  preview?: number;
}) {
  const percent = ratioPercent(current, max);
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink-secondary">{label}</span>
        <span className="font-mono font-semibold tracking-tight">
          {Math.floor(current)}
          <span className="text-ink-secondary font-normal">
            /{Math.floor(max)}
          </span>
          {preview !== undefined ? (
            <span className="text-ink-secondary font-normal">
              {' '}
              → {Math.floor(preview)}
            </span>
          ) : null}
        </span>
      </div>
      <div
        className={cn(
          'bg-ink/12 relative mt-1 overflow-hidden',
          tone === 'hp' ? 'h-2.5' : 'h-1.5',
        )}
      >
        {preview !== undefined ? (
          <div
            className={cn(
              'absolute inset-y-0 left-0 opacity-30',
              METER_COLOR[tone],
            )}
            style={{ width: `${ratioPercent(preview, max)}%` }}
          />
        ) : null}
        <div
          className={cn(
            'absolute inset-y-0 left-0 transition-[width] duration-700',
            METER_COLOR[tone],
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/** 四场进度：一串印章。已胜的落朱砂，当前这场描墨，后面的淡出。 */
export function ExorcismTrack({
  run,
  finished = false,
  label = '本局进度',
}: {
  run: Pick<ExorcismRunState, 'wins'>;
  /** 没有“当前这场”：本局已结束，或开局前的示意。 */
  finished?: boolean;
  label?: string;
}) {
  return (
    <ol className="flex items-center" aria-label={label}>
      {EXORCISM_STAGES.map((name, index) => {
        const done = index < run.wins;
        const current = !finished && index === run.wins;
        return (
          <li key={name} className="flex items-center">
            {index > 0 ? (
              <span
                aria-hidden
                className={cn(
                  'w-3 border-t border-dashed md:w-5',
                  done || current ? 'border-crimson/60' : 'border-ink/25',
                )}
              />
            ) : null}
            <span
              aria-current={current ? 'step' : undefined}
              className={cn(
                'font-heading flex size-10 items-center justify-center text-sm leading-none md:size-11 md:text-base',
                done && 'bg-crimson text-paper -rotate-3',
                current && 'border-ink text-ink border-2',
                !done && !current && 'border-ink/25 text-ink/45 border',
              )}
            >
              {name}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
