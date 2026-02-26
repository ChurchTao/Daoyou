'use client';

import { cn } from '@/lib/cn';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollHint = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const maxLeft = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(maxLeft - el.scrollLeft > 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollHint();
    el.addEventListener('scroll', updateScrollHint, { passive: true });
    window.addEventListener('resize', updateScrollHint);

    const observer = new ResizeObserver(() => updateScrollHint());
    observer.observe(el);

    return () => {
      el.removeEventListener('scroll', updateScrollHint);
      window.removeEventListener('resize', updateScrollHint);
      observer.disconnect();
    };
  }, [items, updateScrollHint]);

  const scrollTabs = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const offset = Math.max(120, Math.floor(el.clientWidth * 0.45));
    el.scrollBy({
      left: direction === 'left' ? -offset : offset,
      behavior: 'smooth',
    });
  };

  return (
    <div className={cn('border-ink/10 relative border-b', className)}>
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollTabs('left')}
          className="text-ink-secondary absolute top-1/2 left-0 z-10 flex -translate-y-1/2 items-center px-2 py-1 text-base"
          aria-label="查看左侧标签"
        >
          ⬅
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollTabs('right')}
          className="text-ink-secondary absolute top-1/2 right-0 z-10 flex -translate-y-1/2 items-center px-2 py-1 text-base"
          aria-label="查看右侧标签"
        >
          ⮕
        </button>
      )}

      <div
        ref={scrollRef}
        className="no-scrollbar flex gap-2 overflow-x-auto whitespace-nowrap"
      >
        {items.map((item) => {
          const isActive = activeValue === item.value;
          return (
            <button
              key={item.value}
              onClick={() => onChange(item.value)}
              className={cn(
                'shrink-0 px-4 py-2 text-base transition-colors',
                isActive
                  ? 'border-crimson text-crimson border-b-2'
                  : 'text-ink/60 hover:text-ink',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
