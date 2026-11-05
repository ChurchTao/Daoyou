import { cn } from '@app/lib/cn';
import type { ExorcismRunState } from '@daoyou/game-domain/dungeon/exorcism';
import { EXORCISM_STAGES, ratioPercent } from './exorcismView';

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
      <div className="flex justify-between text-sm">
        <span className="text-ink-secondary">{label}</span>
        <span className="font-mono font-semibold tracking-tight">
          {percent}%
          {preview !== undefined ? (
            <span className="text-ink-secondary font-normal">
              {' '}
              → {ratioPercent(preview, max)}%
            </span>
          ) : null}
        </span>
      </div>
      <div className="bg-ink/10 relative mt-1 h-2 overflow-hidden rounded-full">
        {preview !== undefined ? (
          <div
            className={cn(
              'absolute inset-y-0 left-0 rounded-full opacity-30',
              tone === 'hp' ? 'bg-crimson' : 'bg-[#5d7380]',
            )}
            style={{ width: `${ratioPercent(preview, max)}%` }}
          />
        ) : null}
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-[width] duration-700',
            tone === 'hp' ? 'bg-crimson' : 'bg-[#5d7380]',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/** 四场进度：已胜的盖朱砂，当前这场描边，后面的淡出。 */
export function ExorcismTrack({
  run,
  finished = false,
}: {
  run: Pick<ExorcismRunState, 'wins'>;
  /** 本局已结束：没有“当前这场”。 */
  finished?: boolean;
}) {
  return (
    <ol className="flex items-center gap-1" aria-label="本局进度">
      {EXORCISM_STAGES.map((name, index) => {
        const done = index < run.wins;
        const current = !finished && index === run.wins;
        return (
          <li key={name} className="flex flex-1 items-center gap-1">
            <span
              aria-current={current ? 'step' : undefined}
              className={cn(
                'flex h-9 flex-1 items-center justify-center rounded-sm border text-sm',
                done && 'border-crimson bg-crimson/10 text-crimson',
                current && 'border-ink text-ink font-semibold',
                !done && !current && 'border-ink/15 text-ink/40',
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

/** 局内唯一的恢复规则，每个决定点都看得到。 */
export function ExorcismRuleLine() {
  return (
    <p className="text-ink-secondary text-xs leading-6">
      局内状态独立于现实：丹药和时间都不能恢复，只有调息能回。
    </p>
  );
}
