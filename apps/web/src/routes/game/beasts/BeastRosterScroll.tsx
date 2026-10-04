import { useEffect, useRef, useState, type ReactNode } from 'react';

export function BeastRosterScroll({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ above: false, below: false });

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const update = () => {
      const above = viewport.scrollTop > 2;
      const below =
        viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop > 2;
      setEdges((previous) =>
        previous.above === above && previous.below === below
          ? previous
          : { above, below },
      );
    };
    update();
    viewport.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    observer.observe(content);
    return () => {
      viewport.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [children]);

  return (
    <div className="relative md:min-h-0 md:flex-1">
      <div
        ref={viewportRef}
        className="focus-visible:outline-teal [&::-webkit-scrollbar-thumb]:bg-ink/20 max-h-60 [scrollbar-width:thin] [scrollbar-color:var(--color-ink-border)_transparent] overflow-y-auto overscroll-y-contain focus-visible:outline-2 focus-visible:outline-offset-2 md:h-full md:max-h-none [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
        role="group"
        aria-label="灵兽名册"
        tabIndex={0}
      >
        <div
          ref={contentRef}
          className="grid grid-cols-3 gap-1 pr-2 md:grid-cols-1"
        >
          {children}
        </div>
      </div>
      {edges.above ? (
        <div
          aria-hidden
          className="from-bgpaper pointer-events-none absolute top-0 right-2 left-0 h-4 bg-linear-to-b to-transparent"
        />
      ) : null}
      {edges.below ? (
        <div
          aria-hidden
          className="from-bgpaper pointer-events-none absolute right-2 bottom-0 left-0 h-4 bg-linear-to-t to-transparent"
        />
      ) : null}
    </div>
  );
}
