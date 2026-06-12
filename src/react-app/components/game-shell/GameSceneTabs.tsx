import { cn } from '@shared/lib/cn';
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
}

export function GameSceneTabs({
  items,
  activeValue,
  onChange,
  className,
}: GameSceneTabsProps) {
  return (
    <InkHorizontalScroll
      ariaLabel="场景标签"
      className={cn('w-full max-w-full min-w-0', className)}
      contentClassName="gap-4"
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
              'shrink-0 border-b-2 px-1 pb-2 text-base transition-colors',
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
