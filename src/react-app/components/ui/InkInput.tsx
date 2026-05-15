import { cn } from '@shared/lib/cn';
import type { ChangeEvent, KeyboardEvent } from 'react';
import type { HTMLInputTypeAttribute } from 'react';
import {
  inkFieldVariants,
  type InkFieldVariantProps,
} from './inkFieldStyles';

export interface InkInputProps extends InkFieldVariantProps {
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
  type?: HTMLInputTypeAttribute;
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
  type = 'text',
  onKeyDown,
  variant,
  size,
}: InkInputProps) {
  const fieldClass = cn(
    inkFieldVariants({ variant, size }),
    multiline && 'battle-scroll min-h-32 resize-y',
    disabled && 'opacity-50 cursor-not-allowed',
  );

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => onChange(event.target.value, event);

  return (
    <label className="flex flex-col gap-1">
      {label && (
        <span className="text-ink font-semibold tracking-[0.08em]">{label}</span>
      )}
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
          type={type}
          className={fieldClass}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          disabled={disabled}
        />
      )}
      {hint && !error && (
        <span className="text-ink-secondary text-[0.82rem]">{hint}</span>
      )}
      {error && <span className="text-crimson text-[0.82rem]">{error}</span>}
    </label>
  );
}
