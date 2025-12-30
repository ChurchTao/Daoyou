'use client';

import { cn } from '@/lib/cn';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';

const inkNoticeVariants = cva('text-center italic my-4', {
  variants: {
    tone: {
      muted: 'text-ink-secondary',
      info: 'text-blue-600',
      warning: 'text-amber-600',
      danger: 'text-crimson',
    },
  },
  defaultVariants: {
    tone: 'muted',
  },
});

export interface InkNoticeProps extends VariantProps<typeof inkNoticeVariants> {
  className?: string;
  children: ReactNode;
}

/**
 * 通知/提示组件
 * 用于空状态、加载提示、警告等
 */
export function InkNotice({
  tone = 'muted',
  className = '',
  children,
}: InkNoticeProps) {
  return (
    <div className={cn(inkNoticeVariants({ tone }), className)}>{children}</div>
  );
}
