import { cn } from '@app/lib/cn';
import {
  useId,
  type ChangeEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';

import { InkField } from './InkField';
import {
  inkFieldVariants,
  type InkFieldVariantProps,
} from './inkFieldStyles';

type NativeSelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  | 'value'
  | 'onChange'
  | 'size'
  | 'children'
  | 'className'
  | 'multiple'
  | 'defaultValue'
>;

export interface InkSelectProps
  extends InkFieldVariantProps,
    NativeSelectProps {
  label?: ReactNode;
  value: string;
  onChange: (value: string, event: ChangeEvent<HTMLSelectElement>) => void;
  hint?: ReactNode;
  error?: string;
  labelClassName?: string;
  containerClassName?: string;
  className?: string;
  disabled?: boolean;
  children: ReactNode;
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
  labelClassName,
  containerClassName,
  className,
  id,
  'aria-describedby': ariaDescribedBy,
  ...rest
}: InkSelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const messageId = `${selectId}-message`;
  const hasMessage = Boolean(error || hint);
  const describedBy =
    [ariaDescribedBy, hasMessage ? messageId : undefined]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <InkField
      id={selectId}
      label={label}
      hint={hint}
      error={error}
      disabled={disabled}
      className={containerClassName}
      labelClassName={labelClassName}
      messageId={messageId}
    >
      <select
        {...rest}
        id={selectId}
        value={value}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value, event)}
        className={cn(inkFieldVariants({ variant, size }), className)}
      >
        {children}
      </select>
    </InkField>
  );
}
