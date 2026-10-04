import { cn } from '@app/lib/cn';
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
        default: 'ink-surface',
        highlighted:
          'border-crimson/35 border-l-2 border-l-crimson',
        elevated: 'border-ink/25 bg-bgpaper',
        plain: '',
      },
      padding: {
        none: '',
        sm: 'p-2',
        md: 'p-3',
        lg: 'p-4 md:p-5',
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
}

/**
 * 文字化卡片组件 - 最小化视觉元素
 * 使用虚线边框分隔，高亮时左侧显示朱砂红边框
 */
export function InkCard({
  children,
  className = '',
  variant,
  padding,
}: InkCardProps) {
  return (
    <div
      className={cn(
        inkCardVariants({ variant, padding }),
        className,
      )}
    >
      {children}
    </div>
  );
}
