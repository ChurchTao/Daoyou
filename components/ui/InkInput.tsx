'use client';

import { cn } from '@/lib/cn';
import type { ChangeEvent, KeyboardEvent } from 'react';

export interface InkInputProps {
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
}: InkInputProps) {
  const fieldClass = cn(
    'w-full border border-ink/20 bg-transparent px-3 py-3',
    'font-sans text-base leading-[1.5]',
    'focus:outline-none focus:border-crimson',
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
        <span className="text-[0.8rem] text-ink-secondary">{hint}</span>
      )}
      {error && <span className="text-[0.8rem] text-crimson">{error}</span>}
    </label>
  );
}
