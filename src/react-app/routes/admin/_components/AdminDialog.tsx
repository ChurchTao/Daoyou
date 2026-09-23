import { InkButton } from '@app/components/ui/InkButton';
import { cn } from '@shared/lib/cn';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Native dialogs keep focus and Escape scoped to the active editor or picker. */
export function AdminDialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);
  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        event.preventDefault();
        event.stopPropagation();
        if (!busy) onClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!busy) onClose();
      }}
      className={cn(
        'bg-bgpaper text-ink border-ink/20 fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-xl overflow-hidden border p-0 shadow-xl backdrop:bg-black/40',
        wide && 'max-w-4xl',
      )}
    >
      {open && (
        <div className="flex max-h-[90dvh] flex-col">
          <header className="border-ink/10 flex shrink-0 items-center justify-between gap-4 border-b px-5 py-4">
            <h3 id={titleId} className="text-lg font-semibold">
              {title}
            </h3>
            <InkButton disabled={busy} onClick={onClose}>
              关闭
            </InkButton>
          </header>
          <div className="battle-scroll min-h-0 overflow-y-auto overscroll-contain p-5">
            {children}
          </div>
          {footer && (
            <footer className="border-ink/10 flex shrink-0 flex-wrap items-center justify-end gap-3 border-t px-5 py-3">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>,
    document.body,
  );
}
