import { InkModal } from '@app/components/layout/InkModal';
import { cn } from '@app/lib/cn';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { InkButton } from './InkButton';

// ============ Dialog State Type ============

export interface InkDialogState {
  id: string;
  title?: string;
  content: ReactNode;
  confirmLabel?: string | null;
  cancelLabel?: string | null;
  loading?: boolean;
  loadingLabel?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
}

// ============ InkDialog ============

export interface InkDialogProps {
  dialog: InkDialogState | null;
  onClose: () => void;
}

/**
 * 对话框组件
 */
export function InkDialog({ dialog, onClose }: InkDialogProps) {
  const [isExecuting, setIsExecuting] = useState(false);

  if (!dialog) {
    return null;
  }

  const {
    title,
    content,
    confirmLabel,
    cancelLabel,
    loading = false,
    loadingLabel = '稍待……',
    onConfirm,
    onCancel,
  } = dialog;
  const effectiveConfirmLabel =
    confirmLabel === undefined ? '允' : confirmLabel;
  const effectiveCancelLabel = cancelLabel === undefined ? '罢' : cancelLabel;
  const isBusy = loading || isExecuting;

  return (
    <InkModal
      isOpen={!!dialog}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          {effectiveCancelLabel !== null ? (
            <InkButton
              onClick={async () => {
                await onCancel?.();
                onClose();
              }}
              disabled={isBusy}
            >
              {effectiveCancelLabel}
            </InkButton>
          ) : null}
          {effectiveConfirmLabel !== null ? (
            <InkButton
              variant="primary"
              pending={isBusy}
              pendingLabel={loadingLabel}
              onClick={async () => {
                if (isBusy) return;
                setIsExecuting(true);
                try {
                  await onConfirm?.();
                } finally {
                  setIsExecuting(false);
                }
                onClose();
              }}
            >
              {effectiveConfirmLabel}
            </InkButton>
          ) : null}
        </div>
      }
    >
      <div className={cn('text-ink', title && 'pt-1')}>{content}</div>
    </InkModal>
  );
}
