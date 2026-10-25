import { cn } from '@app/lib/cn';
import { useId, type ReactNode } from 'react';
import { InkField } from './InkField';
import { INK_CONTROL_HEIGHTS } from './inkFieldStyles';

export interface InkQuantityInputProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  max: number;
  min?: number;
  disabled?: boolean;
  size?: keyof typeof INK_CONTROL_HEIGHTS;
  showLabel?: boolean;
  fullWidth?: boolean;
  hint?: ReactNode;
  error?: string;
  className?: string;
  containerClassName?: string;
  labelClassName?: string;
  id?: string;
}

export function InkQuantityInput({
  label,
  value,
  onChange,
  min = 1,
  max,
  disabled = false,
  size = 'sm',
  showLabel = false,
  fullWidth = false,
  hint,
  error,
  className,
  containerClassName,
  labelClassName,
  id,
}: InkQuantityInputProps) {
  const quantity = Number(value);
  const valid = value !== '' && Number.isInteger(quantity);
  const unavailable = disabled || max < min;
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const hasMessage = Boolean(error || hint);
  const iconWidth =
    size === 'sm' ? 'w-8' : size === 'lg' ? 'w-10' : 'w-9';
  const step = (delta: number) => {
    const next = valid ? quantity + delta : min;
    onChange(String(Math.max(min, Math.min(max, next))));
  };

  const control = (
    <div
      role="group"
      aria-label={`${label}，最多${max}`}
      aria-disabled={unavailable || undefined}
      className={cn(
        'border-ink/20 focus-within:border-crimson items-center border text-base',
        fullWidth ? 'flex w-full' : 'inline-flex max-w-full',
        INK_CONTROL_HEIGHTS[size],
        unavailable && !(showLabel || hasMessage) && 'opacity-60',
        className,
      )}
    >
      <button
        type="button"
        aria-label={`减少${label}`}
        disabled={unavailable || (valid && quantity <= min)}
        onClick={() => step(-1)}
        className={cn(
          'disabled:text-ink-secondary/50 h-full shrink-0 cursor-pointer disabled:cursor-default',
          iconWidth,
        )}
      >
        −
      </button>
      <input
        id={inputId}
        aria-label={label}
        aria-describedby={hasMessage ? messageId : undefined}
        aria-invalid={error ? true : undefined}
        type="number"
        inputMode="numeric"
        step={1}
        min={min}
        max={max}
        value={value}
        disabled={unavailable}
        onChange={(event) => onChange(event.target.value)}
        style={
          fullWidth
            ? undefined
            : { width: `${Math.max(3, String(max).length + 1)}ch` }
        }
        className={cn(
          'border-ink/20 h-full min-w-0 [appearance:textfield] border-x bg-transparent text-center font-mono [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          fullWidth && 'flex-1',
        )}
      />
      <button
        type="button"
        aria-label={`增加${label}`}
        disabled={unavailable || (valid && quantity >= max)}
        onClick={() => step(1)}
        className={cn(
          'disabled:text-ink-secondary/50 h-full shrink-0 cursor-pointer disabled:cursor-default',
          iconWidth,
        )}
      >
        +
      </button>
      <button
        type="button"
        aria-label={`设为最多${max}`}
        disabled={unavailable || (valid && quantity === max)}
        onClick={() => onChange(String(max))}
        className="border-ink/20 disabled:text-ink-secondary/50 h-full shrink-0 cursor-pointer border-l px-1.5 disabled:cursor-default"
      >
        最多
      </button>
    </div>
  );

  if (!showLabel && !hasMessage) return control;

  return (
    <InkField
      id={inputId}
      label={showLabel ? label : undefined}
      hint={hint}
      error={error}
      disabled={unavailable}
      className={containerClassName}
      labelClassName={labelClassName}
      messageId={messageId}
    >
      {control}
    </InkField>
  );
}
