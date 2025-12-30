'use client';

import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

// ============ InkTabs ============

export interface InkTabItem {
  label: ReactNode;
  value: string;
}

export interface InkTabsProps {
  items: InkTabItem[];
  activeValue: string;
  onChange: (value: string) => void;
  className?: string;
}

export function InkTabs({
  items,
  activeValue,
  onChange,
  className = '',
}: InkTabsProps) {
  return (
    <div className={cn('flex gap-2 border-b border-ink/10', className)}>
      {items.map((item) => {
        const isActive = activeValue === item.value;
        return (
          <button
            key={item.value}
            onClick={() => onChange(item.value)}
            className={cn(
              'px-4 py-2 text-base transition-colors',
              isActive
                ? 'border-b-2 border-crimson text-crimson'
                : 'text-ink/60 hover:text-ink',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
