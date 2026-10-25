import { cn } from '@app/lib/cn';
import type { ReactNode } from 'react';

export interface InkFieldProps {
  id?: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  messageId?: string;
  children: ReactNode;
}

/** Shared label, message and disabled state for form controls. */
export function InkField({
  id,
  label,
  hint,
  error,
  disabled = false,
  className,
  labelClassName,
  messageId,
  children,
}: InkFieldProps) {
  const message = error ?? hint;
  const labelClass = cn(
    'text-ink text-sm font-semibold tracking-[0.08em]',
    labelClassName,
  );
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1',
        disabled && 'opacity-60',
        className,
      )}
    >
      {label ? (
        id ? (
          <label htmlFor={id} className={labelClass}>
            {label}
          </label>
        ) : (
          <span className={labelClass}>{label}</span>
        )
      ) : null}
      {children}
      {message ? (
        <p
          id={messageId}
          className={cn(
            'text-xs leading-5',
            error ? 'text-crimson' : 'text-ink-secondary',
          )}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
