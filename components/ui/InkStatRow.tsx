'use client';

import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

export interface InkStatRowProps {
  label: ReactNode;
  code?: string;
  base: number | string;
  final?: number | string;
  detail?: ReactNode;
  emphasize?: boolean;
}

/**
 * 属性行组件
 * 用于显示属性的基础值和最终值
 */
export function InkStatRow({
  label,
  code,
  base,
  final,
  detail,
  emphasize = false,
}: InkStatRowProps) {
  const changed = final !== undefined && final !== base;

  return (
    <div
      className={cn(
        'border-ink/15 border-b border-dashed py-2 text-[0.95rem]',
        emphasize && 'font-semibold',
      )}
    >
      {/* 标签行 */}
      <div className="flex items-baseline gap-1">
        <span>{label}</span>
        {code && (
          <span className="text-ink-secondary text-[0.8rem]">（{code}）</span>
        )}
      </div>

      {/* 数值行 */}
      <div className="mt-1 flex items-center gap-1">
        <span>{base}</span>
        {changed && (
          <span className="text-crimson font-semibold"> → {final}</span>
        )}
      </div>

      {/* 详情 */}
      {detail && (
        <div className="text-ink-secondary mt-1 text-[0.8rem]">{detail}</div>
      )}
    </div>
  );
}
