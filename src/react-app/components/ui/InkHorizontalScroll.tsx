import { cn } from '@shared/lib/cn';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface InkHorizontalScrollProps {
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
  viewportClassName?: string;
  contentClassName?: string;
  edgeClassName?: string;
  showStartHint?: boolean;
}

export function InkHorizontalScroll({
  children,
  ariaLabel,
  className = '',
  viewportClassName = '',
  contentClassName = '',
  edgeClassName = '',
  showStartHint = true,
}: InkHorizontalScrollProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [canScrollStart, setCanScrollStart] = useState(false);
  const [canScrollEnd, setCanScrollEnd] = useState(false);

  const updateScrollEdges = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;

    const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    setCanScrollStart(el.scrollLeft > 2);
    setCanScrollEnd(maxLeft - el.scrollLeft > 2);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    updateScrollEdges();
    viewport.addEventListener('scroll', updateScrollEdges, { passive: true });
    window.addEventListener('resize', updateScrollEdges);

    const observer = new ResizeObserver(() => updateScrollEdges());
    observer.observe(viewport);
    if (contentRef.current) {
      observer.observe(contentRef.current);
    }

    return () => {
      viewport.removeEventListener('scroll', updateScrollEdges);
      window.removeEventListener('resize', updateScrollEdges);
      observer.disconnect();
    };
  }, [updateScrollEdges]);

  return (
    <div className={cn('relative min-w-0 overflow-hidden', className)}>
      <div
        ref={viewportRef}
        className={cn(
          'no-scrollbar min-w-0 touch-pan-x overflow-x-auto overscroll-x-contain',
          viewportClassName,
        )}
        aria-label={ariaLabel}
      >
        <div
          ref={contentRef}
          className={cn('flex min-w-max flex-nowrap', contentClassName)}
        >
          {children}
        </div>
      </div>

      {showStartHint ? (
        <div
          className={cn(
            'pointer-events-none absolute top-1/2 left-0 grid h-6 w-4 -translate-y-1/2 place-items-center opacity-0 transition-opacity duration-150',
            canScrollStart && 'opacity-100',
            edgeClassName,
          )}
          aria-hidden="true"
        >
          <span className="bg-bgpaper/80 text-ink-secondary/55 grid h-6 w-3.5 place-items-center backdrop-blur-sm">
            <svg
              viewBox="0 0 8 12"
              aria-hidden="true"
              className="h-3 w-2"
              fill="none"
            >
              <path
                d="M6 2 2 6l4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      ) : null}

      <div
        className={cn(
          'pointer-events-none absolute top-1/2 -right-px grid h-6 -translate-y-1/2 place-items-center opacity-0 transition-opacity duration-150',
          canScrollEnd && 'opacity-100',
          edgeClassName,
        )}
        aria-hidden="true"
      >
        <span className="bg-bgpaper/35 text-ink-secondary/55 grid h-6 w-3.5 place-items-center backdrop-blur-sm">
          <svg
            viewBox="0 0 8 12"
            aria-hidden="true"
            className="h-3 w-2"
            fill="none"
          >
            <path
              d="M2 2l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </div>
  );
}
