import { cn } from '@shared/lib/cn';
import { InkModal } from '@app/components/layout/InkModal';
import type { ReactNode } from 'react';
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
  if (!dialog) {
    return null;
  }

  const {
    title,
    content,
    confirmLabel,
    cancelLabel,
    loading = false,
    loadingLabel = '稍待...',
    onConfirm,
    onCancel,
  } = dialog;
  const effectiveConfirmLabel =
    confirmLabel === undefined ? '允' : confirmLabel;
  const effectiveCancelLabel = cancelLabel === undefined ? '罢' : cancelLabel;

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
            >
              {effectiveCancelLabel}
            </InkButton>
          ) : null}
          {effectiveConfirmLabel !== null ? (
            <InkButton
              variant="primary"
              onClick={async () => {
                await onConfirm?.();
                onClose();
              }}
              disabled={loading}
            >
              {loading ? loadingLabel : effectiveConfirmLabel}
            </InkButton>
          ) : null}
        </div>
      }
    >
      <div className={cn('text-ink', title && 'pt-1')}>{content}</div>
    </InkModal>
  );
}
