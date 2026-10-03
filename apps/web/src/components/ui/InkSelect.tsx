import { cn } from '@app/lib/cn';
import type { ChangeEvent, ReactNode } from 'react';

import {
  inkFieldVariants,
  type InkFieldVariantProps,
} from './inkFieldStyles';

export interface InkSelectProps extends InkFieldVariantProps {
  label?: string;
  value: string;
  onChange: (value: string, event: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
  hint?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
}

export function InkSelect({
  label,
  value,
  onChange,
  children,
  hint,
  error,
  disabled = false,
  variant,
  size,
  className,
  labelClassName,
}: InkSelectProps) {
  const fieldClass = cn(
    inkFieldVariants({ variant, size }),
    disabled && 'opacity-50 cursor-not-allowed',
    className,
  );

  return (
    <label className="flex flex-col gap-1">
      {label && (
        <span className={cn('text-ink font-semibold tracking-[0.08em]', labelClassName)}>
          {label}
        </span>
      )}
      <select
        className={fieldClass}
        value={value}
        onChange={(event) => onChange(event.target.value, event)}
        disabled={disabled}
      >
        {children}
      </select>
      {hint && !error && (
        <span className="text-ink-secondary text-[0.82rem]">{hint}</span>
      )}
      {error && <span className="text-crimson text-[0.82rem]">{error}</span>}
    </label>
  );
}
