'use client';

import { cn } from '@/lib/cn';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';

const inkTagVariants = cva(
  'inline-flex items-center text-[0.8rem] px-1 rounded-sm',
  {
    variants: {
      variant: {
        default: 'border border-ink/25',
        outline: 'border border-ink/25 bg-transparent',
        ghost: 'border-transparent text-ink-secondary',
      },
      tone: {
        neutral: 'text-ink',
        good: 'text-teal border-teal/50',
        bad: 'text-crimson border-crimson/50',
        info: 'text-blue-600 border-blue-600/40',
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
      {children}
    </span>
  );
}
