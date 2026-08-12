import { cn } from '@shared/lib/cn';
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { InkButton } from './InkButton';

export type InkDetailDrawerSize = 'sm' | 'md' | 'lg' | 'xl';

export interface InkDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  size?: InkDetailDrawerSize;
  closeLabel?: string;
  closeOnEscape?: boolean;
  closeOnOverlayClick?: boolean;
  className?: string;
}

const drawerSizeClass: Record<InkDetailDrawerSize, string> = {
  sm: 'md:w-[min(25rem,92vw)]',
  md: 'md:w-[min(34rem,92vw)]',
  lg: 'md:w-[min(42rem,92vw)]',
  xl: 'md:w-[min(56rem,94vw)]',
};

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** 适用于详情与辅助操作的响应式抽屉：移动端底部展开，桌面端右侧展开。 */
export function InkDetailDrawer({
  isOpen,
  onClose,
  title,
  children,
  description,
  footer,
  size = 'lg',
  closeLabel = '收起',
  closeOnEscape = true,
  closeOnOverlayClick = true,
  className,
}: InkDetailDrawerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape) onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [closeOnEscape, isOpen]);

  const trapFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(focusableSelector),
    ).filter((element) => !element.hasAttribute('disabled'));
    if (focusable.length === 0) {
      event.preventDefault();
      panel.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="ink-overlay absolute inset-0 h-full w-full cursor-default"
        aria-label="关闭详情"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={trapFocus}
        className={cn(
          'ink-detail-drawer bg-bgpaper border-ink/20 absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col border-t shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:h-[100dvh] md:max-h-none md:border-t-0 md:border-l',
          drawerSizeClass[size],
          className,
        )}
      >
        <header className="border-ink/15 shrink-0 border-b border-dashed pt-3 pr-[max(env(safe-area-inset-right),1rem)] pb-3 pl-[max(env(safe-area-inset-left),1rem)] md:pt-[max(env(safe-area-inset-top),1.25rem)] md:pr-[max(env(safe-area-inset-right),1.25rem)] md:pl-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <InkButton onClick={onClose} variant="secondary">
              {closeLabel}
            </InkButton>
          </div>
          {description ? (
            <div
              id={descriptionId}
              className="text-ink-secondary mt-2 text-sm leading-6"
            >
              {description}
            </div>
          ) : null}
        </header>
        <div className="battle-scroll min-h-0 flex-1 overflow-y-auto pt-4 pr-[max(env(safe-area-inset-right),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] pl-[max(env(safe-area-inset-left),1rem)] md:pr-[max(env(safe-area-inset-right),1.25rem)] md:pb-[max(env(safe-area-inset-bottom),1.25rem)] md:pl-5">
          {children}
        </div>
        {footer ? (
          <footer className="border-ink/15 bg-bgpaper shrink-0 border-t border-dashed pt-3 pr-[max(env(safe-area-inset-right),1rem)] pb-[max(env(safe-area-inset-bottom),0.75rem)] pl-[max(env(safe-area-inset-left),1rem)] md:pr-[max(env(safe-area-inset-right),1.25rem)] md:pb-[max(env(safe-area-inset-bottom),1.25rem)] md:pl-5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
