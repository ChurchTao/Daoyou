'use client';

import { cn } from '@/lib/cn';

export interface InkStatusDatum {
  label: string;
  value: number | string;
  icon?: string;
  hint?: string;
}

export interface InkStatusBarProps {
  items: InkStatusDatum[];
  stacked?: boolean;
  className?: string;
}

/**
 * 状态栏组件
 * 用于显示 HP/MP/寿元等状态信息
 */
export function InkStatusBar({
  items,
  stacked = false,
  className = '',
}: InkStatusBarProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap gap-2',
        stacked && 'flex-col items-center',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="text-ink text-[0.9rem]">
          {item.icon && <span className="mr-1">{item.icon}</span>}
          <span>{item.label}</span>
          <span>{item.value}</span>
          {item.hint && (
            <span className="text-ink-secondary ml-1 text-[0.8rem]">
              · {item.hint}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
