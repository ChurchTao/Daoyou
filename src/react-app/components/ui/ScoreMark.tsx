import { cn } from '@shared/lib/cn';
import { formatScore } from '@shared/lib/scoreFormat';

export function ScoreMark({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'text-ink-secondary/70 pointer-events-none inline-flex items-center gap-1 text-sm leading-5',
        className,
      )}
      data-score-mark
    >
      <span
        aria-hidden="true"
        className="border-crimson/45 bg-crimson/8 inline-block h-1.5 w-1.5 shrink-0 rotate-45 border"
      />
      <span className="border-ink/20 inline-flex items-center border-b border-dashed leading-5">
        {formatScore(score)}
      </span>
    </span>
  );
}
