import { cn } from '@shared/lib/cn';
import type { TaskObjectiveProgress } from '@shared/types/task';

export function TaskObjectiveRow({
  objective,
}: {
  objective: TaskObjectiveProgress;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden="true"
        className={cn(
          'mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] leading-none',
          objective.completed
            ? 'bg-emerald-600/10 text-emerald-700'
            : 'border border-ink/25',
        )}
      >
        {objective.completed ? '✓' : ''}
      </span>
      <div className="min-w-0">
        <p
          className={cn(
            'text-sm leading-6 text-ink',
            objective.completed && 'text-ink-secondary',
          )}
        >
          {objective.title}
        </p>
        <p className="text-ink-secondary text-xs leading-5">
          {objective.progressText}
        </p>
      </div>
    </div>
  );
}
