'use client';

import { cn } from '@/lib/cn';

export interface InkDividerProps {
  variant?: 'line' | 'symbol';
  symbol?: string;
  className?: string;
}

/**
 * 分隔线组件
 * line: 虚线分隔
 * symbol: 符号重复（如 ☯）
 */
export function InkDivider({
  variant = 'line',
  symbol = '☯',
  className = '',
}: InkDividerProps) {
  if (variant === 'symbol') {
    return (
      <div
        className={cn(
          'text-center my-4 text-ink/60 text-[1.2rem] tracking-widest',
          className,
        )}
      >
        {symbol.repeat(10)}
      </div>
    );
  }

  return (
    <div className={cn('text-center my-4 text-ink/60 font-mono', className)}>
      ──────────────────────────────
    </div>
  );
}
