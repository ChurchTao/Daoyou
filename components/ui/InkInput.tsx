'use client';

import { cn } from '@/lib/cn';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ChangeEvent, KeyboardEvent } from 'react';

/**
 * InkInput 变体定义
 */
const inkInputVariants = cva(
  // 基础样式
  'w-full bg-transparent font-sans leading-[1.5] focus:outline-none',
  {
    variants: {
      variant: {
        default: 'border border-ink/20 focus:border-crimson',
        outlined: 'border-2 border-ink/30 focus:border-crimson rounded-md',
        underlined:
          'border-b border-ink/20 focus:border-b-crimson border-t-0 border-l-0 border-r-0',
      },
      size: {
        sm: 'px-2 py-2 text-sm',
        md: 'px-3 py-3 text-base',
        lg: 'px-4 py-4 text-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export interface InkInputProps extends VariantProps<typeof inkInputVariants> {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (
    value: string,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  multiline?: boolean;
  rows?: number;
  hint?: string;
  error?: string;
  disabled?: boolean;
  onKeyDown?: (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
}

/**
 * 输入框组件
 * 支持单行输入和多行文本域
 */
export function InkInput({
  label,
  placeholder,
  value,
  onChange,
  multiline = false,
  rows = 4,
  hint,
  error,
  disabled = false,
  onKeyDown,
  variant,
  size,
}: InkInputProps) {
  const fieldClass = cn(
    inkInputVariants({ variant, size }),
    multiline && 'min-h-32 resize-y',
    disabled && 'opacity-50 cursor-not-allowed',
  );

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => onChange(event.target.value, event);

  return (
    <label className="flex flex-col gap-1">
      {label && <span className="font-semibold tracking-wide">{label}</span>}
      {multiline ? (
        <textarea
          className={fieldClass}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          rows={rows}
          disabled={disabled}
        />
      ) : (
        <input
          type="text"
          className={fieldClass}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          disabled={disabled}
        />
      )}
      {hint && !error && (
        <span className="text-ink-secondary text-[0.8rem]">{hint}</span>
      )}
      {error && <span className="text-crimson text-[0.8rem]">{error}</span>}
    </label>
  );
}
