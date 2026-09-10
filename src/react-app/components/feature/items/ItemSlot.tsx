import { cn } from '@shared/lib/cn';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { EquipmentDetails } from '../forging/EquipmentDetails';
import { ConsumableDetails } from './ConsumableDetails';
import { itemPresentation, type DisplayItem } from './itemPresentation';

export function InventoryGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-4 gap-2 sm:grid-cols-8', className)}>
      {children}
    </div>
  );
}

/** Native auto popovers share one top-layer preview, including inside bag drawers. */
export function ItemSlot({
  item,
  selected,
  disabled,
  badge,
  emptyLabel = '空格',
  emptyIcon = '·',
  className,
  onQuickAction,
  quickOnTouch,
  children,
  comparisonItem,
  quantityLabel = '持有',
}: {
  item?: DisplayItem;
  selected?: boolean;
  disabled?: boolean;
  badge?: string;
  emptyLabel?: string;
  emptyIcon?: string;
  className?: string;
  onQuickAction?: () => void;
  quickOnTouch?: boolean;
  children?: (close: () => void) => ReactNode;
  comparisonItem?: DisplayItem;
  quantityLabel?: '持有' | '库存';
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pointer = useRef('');
  const presentation = item ? itemPresentation(item) : undefined;
  function cancel() {
    clearTimeout(timer.current);
  }
  function close() {
    cancel();
    panel.current?.hidePopover();
  }
  function show() {
    cancel();
    if (item) panel.current?.showPopover();
  }
  function leave() {
    cancel();
    timer.current = setTimeout(close, 220);
  }
  useEffect(() => () => clearTimeout(timer.current), []);
  useLayoutEffect(() => {
    if (!open) {
      panel.current?.hidePopover();
      return;
    }
    const position = () => {
      const element = panel.current;
      const anchor = trigger.current;
      if (!element || !anchor) return;
      const rect = anchor.getBoundingClientRect();
      const viewport = window.visualViewport;
      const x = (viewport?.offsetLeft ?? 0) + 8;
      const y = (viewport?.offsetTop ?? 0) + 8;
      const width = (viewport?.width ?? window.innerWidth) - 16;
      const height = (viewport?.height ?? window.innerHeight) - 16;
      element.style.maxWidth = `${width}px`;
      element.style.maxHeight = `${height}px`;
      const size = element.getBoundingClientRect();
      const left =
        rect.right + 8 + size.width <= x + width
          ? rect.right + 8
          : rect.left - size.width - 8;
      element.style.left = `${Math.max(x, Math.min(left, x + width - size.width))}px`;
      element.style.top = `${Math.max(y, Math.min(rect.top, y + height - size.height))}px`;
    };
    position();
    const observer = new ResizeObserver(position);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    window.visualViewport?.addEventListener('resize', position);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('resize', position);
    };
  }, [open]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={
          item ? `${item.name}，${item.quantity}件` : emptyLabel || '空格'
        }
        aria-expanded={item ? open : undefined}
        aria-disabled={disabled || (!item && !onQuickAction)}
        tabIndex={!item && !onQuickAction ? -1 : undefined}
        aria-haspopup={item ? 'dialog' : undefined}
        className={cn(
          'bg-paper border-ink/20 hover:border-crimson/50 @container relative aspect-square min-h-0 min-w-0 cursor-pointer overflow-hidden border text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
          selected && 'outline-crimson/50 outline outline-offset-1',
          disabled && 'cursor-default opacity-60',
          className,
        )}
        onPointerDown={(e) => {
          pointer.current = e.pointerType;
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse' && item) {
            cancel();
            timer.current = setTimeout(show, 200);
          }
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') leave();
        }}
        onFocus={(e) => {
          if (e.currentTarget.matches(':focus-visible')) show();
        }}
        onKeyDown={(event) => {
          pointer.current = '';
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            close();
          }
        }}
        onClick={() => {
          if (
            onQuickAction &&
            (pointer.current !== 'touch' || !item || quickOnTouch) &&
            !disabled
          ) {
            close();
            onQuickAction();
          } else show();
        }}
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute grid place-items-center leading-none',
            item
              ? 'inset-x-0 top-[10%] bottom-[24%] text-[clamp(1.5rem,48cqw,2.75rem)]'
              : emptyLabel && emptyIcon !== '·'
                ? 'text-ink/25 inset-x-0 top-[10%] bottom-[24%] text-[clamp(1.5rem,48cqw,2.75rem)]'
                : 'text-ink/25 inset-0 text-xl',
          )}
        >
          {presentation?.icon ?? emptyIcon}
        </span>
        {item || emptyLabel ? (
          <span
            className={cn(
              'absolute inset-x-1 bottom-[8%] truncate text-center text-[clamp(0.625rem,17cqw,0.75rem)] leading-tight',
              presentation?.color,
            )}
          >
            {item?.name ?? emptyLabel}
          </span>
        ) : null}
        {item && item.quantity > 1 ? (
          <span className="text-ink absolute top-1 left-1 font-mono text-[clamp(0.75rem,20cqw,1rem)] leading-none font-semibold tracking-tight [text-shadow:0_1px_2px_var(--color-paper)]">
            <span className="text-[0.75em]">×</span>
            {item.quantity >= 10000
              ? `${Math.floor(item.quantity / 1000)}k`
              : item.quantity}
          </span>
        ) : null}
        {badge || item?.equipped ? (
          <span className="text-crimson bg-paper/90 absolute top-0 right-1 text-[10px]">
            {badge ?? '已装备'}
          </span>
        ) : null}
      </button>
      <div
        ref={panel}
        popover="auto"
        role="dialog"
        aria-label={item?.name ?? '物品预览'}
        onToggle={(e) => setOpen(e.newState === 'open')}
        onPointerEnter={cancel}
        onPointerLeave={(e) => {
          if (
            e.pointerType === 'mouse' &&
            !panel.current?.contains(document.activeElement)
          )
            leave();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Tab') e.stopPropagation();
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            trigger.current?.focus();
            close();
          }
        }}
        className="bg-bgpaper text-ink border-ink/30 fixed inset-auto m-0 w-80 overflow-y-auto overscroll-contain border p-4 text-sm leading-6 [overflow-wrap:anywhere] shadow-xl"
      >
        {open && item && presentation ? (
          <>
            <header className="border-ink/15 mb-3 flex items-start gap-3 border-b pb-3">
              <span aria-hidden="true" className="text-3xl">
                {presentation.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('font-medium', presentation.color)}>
                  {item.name}
                </p>
                <p className="text-ink-secondary text-xs">
                  {[
                    presentation.type,
                    presentation.tier,
                    `${quantityLabel} ${item.quantity}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <button
                type="button"
                aria-label="关闭物品预览"
                onClick={close}
                className="min-h-9 min-w-9 cursor-pointer"
              >
                ×
              </button>
            </header>
            {item.definitionId === 'equipment.v6' ? (
              <>
                <EquipmentDetails data={item.instanceData} />
                {comparisonItem ? (
                  <details className="border-ink/15 mt-3 border-t pt-3">
                    <summary className="text-ink-secondary cursor-pointer">
                      与已穿戴的{comparisonItem.name}对比
                    </summary>
                    <div className="mt-3">
                      <EquipmentDetails
                        data={item.instanceData}
                        previous={comparisonItem.instanceData}
                      />
                    </div>
                  </details>
                ) : null}
              </>
            ) : item.definitionId === 'consumable.v1' ? (
              <ConsumableDetails
                data={item.instanceData}
                quantity={item.quantity}
              />
            ) : (
              <p className="whitespace-pre-line">{presentation.description}</p>
            )}
            {children ? (
              <div className="border-ink/15 mt-3 space-y-3 border-t pt-3">
                {children(() => setOpen(false))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );
}
