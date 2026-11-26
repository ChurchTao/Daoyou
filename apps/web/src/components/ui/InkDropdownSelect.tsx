import { cn } from '@app/lib/cn';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

export interface InkDropdownSelectProps {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}

export function InkDropdownSelect({
  label,
  value,
  options,
  onChange,
}: InkDropdownSelectProps) {
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const selected = options.findIndex((option) => option.value === value);
  const open = active !== null;

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setActive(null);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  useLayoutEffect(() => {
    const panel = list.current;
    const option = active === null ? null : panel?.children.item(active);
    if (!panel || !(option instanceof HTMLElement)) return;
    const bottom = option.offsetTop + option.offsetHeight;
    if (option.offsetTop < panel.scrollTop) panel.scrollTop = option.offsetTop;
    else if (bottom > panel.scrollTop + panel.clientHeight)
      panel.scrollTop = bottom - panel.clientHeight;
  }, [active]);

  function choose(index: number) {
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
    setActive(null);
  }

  function navigate(event: KeyboardEvent<HTMLButtonElement>) {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Home':
      case 'End': {
        event.preventDefault();
        const direction = event.key === 'ArrowUp' ? -1 : 1;
        const index =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? options.length - 1
              : active === null
                ? Math.max(0, selected)
                : Math.max(0, Math.min(active + direction, options.length - 1));
        setActive(index);
        break;
      }
      case 'Enter':
      case ' ':
        if (active !== null) {
          event.preventDefault();
          choose(active);
        }
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          setActive(null);
        }
        break;
    }
  }

  return (
    <div ref={root} className="relative inline-flex max-w-full min-w-0">
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-expanded={open}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        disabled={options.length === 0}
        className="group text-ink hover:text-crimson focus-visible:outline-crimson inline-flex min-h-11 max-w-full min-w-11 cursor-pointer items-center rounded-sm px-0.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={(event) => {
          event.currentTarget.focus();
          setActive(open ? null : Math.max(0, selected));
        }}
        onBlur={() => setActive(null)}
        onKeyDown={navigate}
      >
        <span
          className={cn(
            'flex min-w-0 items-center gap-2.5 border-b px-0.5 pb-1',
            open
              ? 'border-crimson text-crimson'
              : 'border-ink-border group-hover:border-crimson/50',
          )}
        >
          <span className="truncate">{options[selected]?.label ?? label}</span>
          <span
            aria-hidden="true"
            className={cn(
              'size-1.5 shrink-0 rotate-45 border-r border-b border-current',
              open ? 'translate-y-0.5 rotate-225' : '-translate-y-0.5',
            )}
          />
        </span>
      </button>
      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-label={label}
          className="bg-bgpaper border-ink-border text-ink absolute inset-s-0 top-[calc(100%-0.25rem)] z-10 max-h-[min(15rem,calc(var(--overlay-viewport-height,100dvh)*0.44))] w-max max-w-[min(16rem,calc(100vw-3rem))] min-w-36 overflow-y-auto overscroll-contain rounded-sm border p-0.5 text-sm shadow-lg"
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === selected}
              className={cn(
                'hover:bg-ink/5 flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-xs px-3 py-1.5 wrap-anywhere',
                index === selected && 'text-crimson font-semibold',
                index === active &&
                  'bg-ink/5 outline-crimson/45 outline -outline-offset-1',
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
              {index === selected && <span aria-hidden="true">✓</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
