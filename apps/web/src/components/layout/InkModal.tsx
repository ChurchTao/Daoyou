import { cn } from '@app/lib/cn';
import { useBodyScrollLock } from '@app/lib/hooks/useBodyScrollLock';
import { useOverlayViewport } from '@app/lib/hooks/useOverlayViewport';
import {
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

export interface InkModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  manageFocus?: boolean;
}

/**
 * 模态框组件
 * 使用 Portal 渲染到 body，支持 Escape 键关闭
 */
export function InkModal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  className = '',
  manageFocus = false,
}: InkModalProps) {
  const [mounted, setMounted] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useBodyScrollLock(isOpen);
  useOverlayViewport(viewportRef, mounted && isOpen);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!mounted || !isOpen || !manageFocus || !dialog) return;
    const opener = document.activeElement;
    dialog.focus();

    function keepFocus(event: KeyboardEvent) {
      if (event.key !== 'Tab' || !dialog) return;
      const fields = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button, input, select, textarea, summary, [tabindex]',
        ),
      ).filter(
        (field) =>
          field.tabIndex >= 0 &&
          !field.matches(':disabled') &&
          field.getClientRects().length,
      );
      const first = fields[0];
      const last = fields.at(-1);
      const active = document.activeElement;
      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
      } else if (
        !fields.some((field) => field === active) ||
        (event.shiftKey ? active === first : active === last)
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }
    document.addEventListener('keydown', keepFocus);
    return () => {
      document.removeEventListener('keydown', keepFocus);
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    };
  }, [mounted, isOpen, manageFocus]);

  // Escape 键关闭
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      ref={viewportRef}
      className="fixed inset-0 z-50 flex items-center justify-center pt-[max(var(--app-safe-top),0.75rem)] pr-[max(env(safe-area-inset-right),0.75rem)] pb-[max(env(safe-area-inset-bottom),0.75rem)] pl-[max(env(safe-area-inset-left),0.75rem)] md:pt-[max(var(--app-safe-top),1rem)] md:pr-[max(env(safe-area-inset-right),1rem)] md:pb-[max(env(safe-area-inset-bottom),1rem)] md:pl-[max(env(safe-area-inset-left),1rem)]"
    >
      {/* 遮罩层 */}
      <div className="ink-overlay absolute inset-0" onClick={onClose} />

      {/* 模态框内容 */}
      <div
        ref={dialogRef}
        className={cn(
          'bg-bgpaper border-ink/20 relative z-10 flex max-h-full min-h-0 w-full max-w-md flex-col border p-4 md:p-5',
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={manageFocus ? -1 : undefined}
      >
        {title && (
          <h3
            id={titleId}
            className="text-ink font-heading shrink-0 text-center text-[1.35rem]"
          >
            {title}
          </h3>
        )}

        <div
          className={cn(
            'battle-scroll max-h-[60dvh] min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain',
            title && 'mt-3',
          )}
        >
          {children}
        </div>

        {footer && (
          <div className="border-ink/15 mt-4 shrink-0 border-t border-dashed pt-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
