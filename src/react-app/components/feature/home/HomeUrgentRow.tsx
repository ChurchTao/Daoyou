import { cn } from '@shared/lib/cn';
import type { ReactNode } from 'react';

interface HomeUrgentRowProps {
  title: ReactNode;
  summary: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function HomeUrgentRow({
  title,
  summary,
  action,
  className,
}: HomeUrgentRowProps) {
  return (
    <div
      className={cn(
        'border-ink/10 grid gap-x-4 gap-y-2 border-b border-dashed py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center',
        className,
      )}
    >
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3">
        <div className="text-ink flex shrink-0 flex-wrap items-center gap-1 self-start pt-0.5 text-sm font-semibold tracking-[0.04em]">
          {title}
        </div>
        <div className="text-ink-secondary min-w-0 flex-1 break-words text-sm leading-6">
          {summary}
        </div>
      </div>
      {action ? (
        <div className="shrink-0 justify-self-end sm:self-center">{action}</div>
      ) : null}
    </div>
  );
}
