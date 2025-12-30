'use client';

import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

export interface InkCardProps {
  children: ReactNode;
  className?: string;
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
}: InkCardProps) {
  return (
    <div
      className={cn(
        'py-3 mb-3 border-b border-dashed border-ink/10',
        highlighted && 'border-l-2 border-l-crimson pl-3 text-crimson',
        className,
      )}
    >
      {children}
    </div>
  );
}
