import { cn } from '@shared/lib/cn';
import type { ReactNode } from 'react';

/** All character-sheet values share this label column and text baseline. */
export function CharacterSheetRow({
  label,
  children,
  className = '',
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] items-start gap-x-3 py-2 text-sm leading-6',
        className,
      )}
    >
      <dt className="text-ink-secondary">{label}</dt>
      <dd className="min-w-0 break-words whitespace-pre-wrap">{children}</dd>
    </div>
  );
}
