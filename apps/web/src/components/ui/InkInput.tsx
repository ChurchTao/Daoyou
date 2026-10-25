import { cn } from '@app/lib/cn';
import {
  useId,
  type ChangeEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { InkField } from './InkField';
import {
  inkFieldVariants,
  type InkFieldVariantProps,
} from './inkFieldStyles';

type NativeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  | 'value'
  | 'onChange'
  | 'onKeyDown'
  | 'size'
  | 'children'
  | 'className'
  | 'defaultValue'
>;

export interface InkInputProps extends InkFieldVariantProps, NativeInputProps {
  label?: ReactNode;
  value: string;
  onChange: (
    value: string,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  multiline?: boolean;
  rows?: number;
  hint?: ReactNode;
  error?: string;
  labelClassName?: string;
  containerClassName?: string;
  className?: string;
  onKeyDown?: (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
}

/**
 * 统一表单输入。原生 input 属性会透传；multiline 时使用 textarea。
 */
export function InkInput({
  label,
  value,
  onChange,
  multiline = false,
  rows = 4,
  hint,
  error,
  disabled = false,
  type = 'text',
  min,
  max,
  onKeyDown,
  variant,
  size,
  labelClassName,
  containerClassName,
  className,
  id,
  'aria-describedby': ariaDescribedBy,
  ...rest
}: InkInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const hasMessage = Boolean(error || hint);
  const describedBy =
    [ariaDescribedBy, hasMessage ? messageId : undefined]
      .filter(Boolean)
      .join(' ') || undefined;
  const fieldClass = cn(
    inkFieldVariants({ variant, size }),
    multiline
      ? 'battle-scroll h-auto min-h-24 resize-y py-2'
      : type === 'number' &&
          'font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
    className,
  );
  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => onChange(event.target.value, event);
  const controlProps = {
    id: inputId,
    value,
    disabled,
    onKeyDown,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    className: fieldClass,
  };
  return (
    <InkField
      id={inputId}
      label={label}
      hint={hint}
      error={error}
      disabled={disabled}
      className={containerClassName}
      labelClassName={labelClassName}
      messageId={messageId}
    >
      {multiline ? (
        <textarea
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          {...controlProps}
          rows={rows}
          onChange={handleChange}
        />
      ) : (
        <input
          {...rest}
          {...controlProps}
          type={type}
          min={min}
          max={max}
          onChange={handleChange}
        />
      )}
    </InkField>
  );
}
