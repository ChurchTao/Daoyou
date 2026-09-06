import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

/** Non-interactive help content; shared hover, keyboard and touch trigger. */
export function InkTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const pointerType = useRef('');
  const cancelLeave = () => clearTimeout(leaveTimer.current);
  const leave = () => {
    cancelLeave();
    leaveTimer.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => () => clearTimeout(leaveTimer.current), []);

  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const anchor = trigger.current;
      const tooltip = panel.current;
      if (!anchor || !tooltip) return;
      const rect = anchor.getBoundingClientRect();
      const viewport = window.visualViewport;
      const leftEdge = (viewport?.offsetLeft ?? 0) + 12;
      const topEdge = (viewport?.offsetTop ?? 0) + 12;
      const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth) - 24;
      const bottomEdge =
        topEdge + (viewport?.height ?? window.innerHeight) - 24;
      tooltip.style.maxWidth = `${rightEdge - leftEdge}px`;
      tooltip.style.maxHeight = `${bottomEdge - topEdge}px`;
      const { width, height } = tooltip.getBoundingClientRect();
      const left = Math.max(
        leftEdge,
        Math.min(rect.left + rect.width / 2 - width / 2, rightEdge - width),
      );
      const preferredTop =
        rect.top - height - 8 >= topEdge
          ? rect.top - height - 8
          : rect.bottom + 8;
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${Math.max(topEdge, Math.min(preferredTop, bottomEdge - height))}px`;
    };
    position();
    const observer = new ResizeObserver(position);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    window.visualViewport?.addEventListener('resize', position);
    window.visualViewport?.addEventListener('scroll', position);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      window.visualViewport?.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('scroll', position);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !trigger.current?.contains(event.target) &&
        !panel.current?.contains(event.target)
      )
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        className="text-ink-secondary hover:text-ink focus-visible:outline-ink hover:bg-ink/5 inline-flex size-9 shrink-0 cursor-help items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') {
            cancelLeave();
            setOpen(true);
          }
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') leave();
        }}
        onKeyDown={() => {
          pointerType.current = '';
        }}
        onPointerDown={(event) => {
          pointerType.current = event.pointerType;
        }}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) setOpen(true);
        }}
        onBlur={() => {
          cancelLeave();
          setOpen(false);
        }}
        onClick={() => {
          cancelLeave();
          setOpen((value) => (pointerType.current === 'touch' ? !value : true));
        }}
      >
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 0 1 5 .3c0 1.7-2.5 1.9-2.5 3.7" />
          <path d="M12 16.5h.01" />
        </svg>
      </button>
      {open
        ? createPortal(
            <div
              ref={panel}
              id={id}
              role="tooltip"
              className="bg-bgpaper text-ink border-ink/20 fixed z-[70] w-72 overflow-y-auto rounded-md border px-3 py-2.5 text-sm leading-6 [overflow-wrap:anywhere] shadow-lg"
              onPointerEnter={cancelLeave}
              onPointerLeave={(event) => {
                if (event.pointerType === 'mouse') leave();
              }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
