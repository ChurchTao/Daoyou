import { createPortal } from 'react-dom';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '@shared/lib/cn';
import { InkButton } from './InkButton';

export interface InkDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** 适用于长篇详情的响应式抽屉：移动端底部展开，桌面端右侧展开。 */
export function InkDetailDrawer({
  isOpen,
  onClose,
  title,
  children,
  footer,
  className,
}: InkDetailDrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="ink-overlay absolute inset-0 h-full w-full cursor-default"
        aria-label="关闭详情"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'ink-detail-drawer bg-bgpaper border-ink/20 absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col border-t shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:h-[100dvh] md:max-h-none md:w-[min(42rem,92vw)] md:border-t-0 md:border-l',
          className,
        )}
      >
        <header className="border-ink/15 flex shrink-0 items-center justify-between gap-3 border-b border-dashed px-4 py-3 md:px-5">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <InkButton onClick={onClose} variant="secondary">收起</InkButton>
        </header>
        <div className="battle-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">
          {children}
        </div>
        {footer ? (
          <footer className="border-ink/15 bg-bgpaper shrink-0 border-t border-dashed px-4 py-3 md:px-5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
