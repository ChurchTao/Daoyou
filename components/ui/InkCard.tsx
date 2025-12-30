'use client';

import { cn } from '@/lib/cn';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';

/**
 * InkCard 变体定义
 */
const inkCardVariants = cva(
  // 基础样式
  'mb-3',
  {
    variants: {
      variant: {
        default: 'border-b border-dashed border-ink/10',
        highlighted:
          'border-l-2 border-l-crimson pl-3 border-b border-dashed border-ink/10',
        elevated: 'shadow-sm bg-paper/50 border border-ink/10 rounded-lg',
        plain: '',
      },
      padding: {
        none: '',
        sm: 'py-2',
        md: 'py-3',
        lg: 'py-4 px-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'md',
    },
  },
);

export interface InkCardProps extends VariantProps<typeof inkCardVariants> {
  children: ReactNode;
  className?: string;
  /** @deprecated 使用 variant="highlighted" 代替 */
  highlighted?: boolean;
}

/**
 * 文字化卡片组件 - 最小化视觉元素
 * 使用虚线边框分隔，高亮时左侧显示朱砂红边框
 */
export function InkCard({
  children,
  className = '',
  highlighted = false,
  variant,
  padding,
}: InkCardProps) {
  // 兼容旧的 highlighted prop
  const effectiveVariant = highlighted ? 'highlighted' : variant;

  return (
    <div
      className={cn(
        inkCardVariants({ variant: effectiveVariant, padding }),
        highlighted && 'text-crimson',
        className,
      )}
    >
      {children}
    </div>
  );
}
