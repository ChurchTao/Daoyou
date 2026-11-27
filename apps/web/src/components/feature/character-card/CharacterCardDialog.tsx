import { InkButton } from '@app/components/ui/InkButton';
import { useBodyScrollLock } from '@app/lib/hooks/useBodyScrollLock';
import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './character-card.css';

export function CharacterCardDialog({
  title = '道友名片',
  closeLabel = '关闭名片',
  onClose,
  footer,
  children,
}: {
  title?: string;
  closeLabel?: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useBodyScrollLock(true);
  useLayoutEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="character-card-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') event.stopPropagation();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          onClose();
      }}
    >
      <header className="border-ink/15 flex items-center justify-between gap-3 border-b px-4">
        <h2 id={titleId} className="text-ink-secondary text-sm tracking-widest">
          {title}
        </h2>
        <InkButton variant="secondary" className="min-h-11" onClick={onClose}>
          {closeLabel}
        </InkButton>
      </header>
      <div className="battle-scroll min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4">
        {children}
      </div>
      {footer && (
        <footer className="border-ink/15 border-t px-4 py-2">{footer}</footer>
      )}
    </dialog>,
    document.body,
  );
}
