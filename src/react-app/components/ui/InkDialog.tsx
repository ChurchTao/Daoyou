import { cn } from '@shared/lib/cn';
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
    <div
      className={cn(
        'fixed inset-0 z-300 flex items-center justify-center p-4',
        'bg-[rgba(20,10,5,0.55)]',
      )}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'bg-paper w-[min(90vw,420px)] p-4',
          'border-ink/20 border border-dashed',
        )}
      >
        {/* 标题 */}
        {title && <h3 className="font-heading mb-2 text-[1.25rem]">{title}</h3>}

        {/* 内容 */}
        <div className="text-ink mb-3">{content}</div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2">
          {effectiveCancelLabel !== null ? (
            <InkButton
              onClick={() => {
                onCancel?.();
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
      </div>
    </div>
  );
}
