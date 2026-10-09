import { cn } from '@app/lib/cn';
import type { ReactNode } from 'react';

export const settingsLabelClass =
  'text-battle-muted text-[0.72rem] tracking-[0.18em]';

export function SettingsField({
  label,
  value,
  action,
  mono = false,
}: {
  label: ReactNode;
  value: ReactNode;
  action?: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="border-ink/15 border-b border-dashed py-3 last:border-b-0">
      <div className={settingsLabelClass}>{label}</div>
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
        <span
          className={cn(
            'text-ink min-w-0 text-[0.95rem] break-all',
            mono && 'font-mono text-[0.88rem]',
          )}
        >
          {value}
        </span>
        {action}
      </div>
    </div>
  );
}

export function SettingsSection({
  title,
  description,
  aside,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'border-ink/15 border-t border-dashed pt-4 first:border-t-0 first:pt-0',
        className,
      )}
    >
      {(title || description || aside) && (
        <SettingsSectionHeader
          title={title}
          description={description}
          aside={aside}
        />
      )}
      {children}
    </section>
  );
}

export function SettingsSectionHeader({
  title,
  description,
  aside,
}: {
  title?: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {title ? <div className={settingsLabelClass}>{title}</div> : null}
        {description ? (
          <p className="text-ink-secondary mt-1 text-sm leading-6">
            {description}
          </p>
        ) : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}

export function SettingsMessage({
  type = 'muted',
  children,
  className,
}: {
  type?: 'muted' | 'success' | 'error';
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'text-sm leading-6',
        type === 'success' && 'text-teal',
        type === 'error' && 'text-crimson',
        type === 'muted' && 'text-ink-secondary',
        className,
      )}
    >
      {children}
    </span>
  );
}
