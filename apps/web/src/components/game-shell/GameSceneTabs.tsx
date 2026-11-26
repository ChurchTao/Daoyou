import { cn } from '@app/lib/cn';
import { InkHorizontalScroll } from '@app/components/ui/InkHorizontalScroll';
import type { ReactNode } from 'react';

export interface GameSceneTabItem {
  label: ReactNode;
  value: string;
}

export interface GameSceneTabsProps {
  items: GameSceneTabItem[];
  activeValue: string;
  onChange: (value: string) => void;
  className?: string;
  compact?: boolean;
}

export function GameSceneTabs({
  items,
  activeValue,
  onChange,
  className,
  compact = false,
}: GameSceneTabsProps) {
  return (
    <InkHorizontalScroll
      ariaLabel="场景标签"
      className={cn('w-full max-w-full min-w-0', className)}
      contentClassName={compact ? 'gap-1 sm:gap-4' : 'gap-4'}
      edgeVerticalClassName="top-[0.75rem] -translate-y-1/2"
    >
      {items.map((item) => {
        const isActive = activeValue === item.value;

        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            aria-pressed={isActive}
            className={cn(
              'shrink-0 border-b-2 pb-2 transition-colors',
              compact ? 'px-0.5 text-sm sm:px-1 sm:text-base' : 'px-1 text-base',
              isActive
                ? 'border-crimson text-crimson font-semibold'
                : 'border-transparent text-ink-secondary hover:text-ink',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </InkHorizontalScroll>
  );
}
