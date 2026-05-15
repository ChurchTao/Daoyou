import { cn } from '@shared/lib/cn';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';

const inkTagVariants = cva(
  'inline-flex items-center gap-0.5 text-[0.82rem] leading-[1.4]',
  {
    variants: {
      variant: {
        default: '',
        outline: 'ink-emphasis',
        ghost: 'opacity-80',
      },
      tone: {
        neutral: 'text-ink-secondary',
        good: 'text-teal',
        bad: 'text-crimson',
        info: 'text-wood',
      },
    },
    defaultVariants: {
      variant: 'default',
      tone: 'neutral',
    },
  },
);

export interface InkTagProps extends VariantProps<typeof inkTagVariants> {
  children: ReactNode;
  className?: string;
}

/**
 * 标签组件 - 用于元素/状态等标记
 */
export function InkTag({
  children,
  variant = 'default',
  tone = 'neutral',
  className = '',
}: InkTagProps) {
  return (
    <span className={cn(inkTagVariants({ variant, tone }), className)}>
      <span aria-hidden="true">「</span>
      <span>{children}</span>
      <span aria-hidden="true">」</span>
    </span>
  );
}
