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
            'text-ink min-w-0 break-all text-[0.95rem]',
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

export function SettingsToggle({
  checked,
  onChange,
  disabled,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: ReactNode;
  description?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      aria-pressed={checked}
      className={cn(
        'flex w-full items-center justify-between gap-3 text-left',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span className="min-w-0">
        <span className="text-ink block text-sm leading-6">{label}</span>
        {description ? (
          <span className="text-ink-secondary block text-xs leading-5">
            {description}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          'border-ink/20 relative h-6 w-11 shrink-0 border border-dashed bg-ink/5 transition-colors',
          checked && 'border-crimson/45 bg-crimson/8',
        )}
      >
        <span
          className={cn(
            'bg-ink/45 absolute top-1 left-1 h-3.5 w-3.5 transition-transform',
            checked && 'bg-crimson translate-x-[1.25rem]',
          )}
        />
      </span>
    </button>
  );
}
