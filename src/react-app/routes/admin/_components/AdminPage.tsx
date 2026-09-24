import type { ReactNode } from 'react';

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="border-ink/15 flex flex-wrap items-start justify-between gap-4 border-b pb-5">
      <div>
        <h2 className="font-heading text-ink text-3xl">{title}</h2>
        {description && (
          <p className="text-ink-secondary mt-2 text-sm">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function AdminSteps({
  labels,
  current,
}: {
  labels: string[];
  current: number;
}) {
  return (
    <ol
      aria-label="操作步骤"
      className="border-ink/10 flex gap-5 border-b pb-4 text-sm"
    >
      {labels.map((label, index) => (
        <li
          key={label}
          aria-current={index === current ? 'step' : undefined}
          className={
            index === current
              ? 'text-crimson font-semibold'
              : 'text-ink-secondary'
          }
        >
          <span className="mr-1.5 font-mono">{index + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}
