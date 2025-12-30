'use client';

import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';
import { InkButton } from './InkButton';

// ============ Dialog State Type ============

export interface InkDialogState {
  id: string;
  title?: string;
  content: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
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
    confirmLabel = '允',
    cancelLabel = '罢',
    loading = false,
    loadingLabel = '稍待...',
    onConfirm,
    onCancel,
  } = dialog;

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
          'border border-ink/20 shadow-[0_10px_25px_rgba(0,0,0,0.2)]',
        )}
      >
        {/* 标题 */}
        {title && <h3 className="text-[1.25rem] mb-2 font-heading">{title}</h3>}

        {/* 内容 */}
        <div className="mb-3 text-ink">{content}</div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2">
          <InkButton
            onClick={() => {
              onCancel?.();
              onClose();
            }}
          >
            {cancelLabel}
          </InkButton>
          <InkButton
            variant="primary"
            onClick={async () => {
              await onConfirm?.();
              onClose();
            }}
            disabled={loading}
          >
            {loading ? loadingLabel : confirmLabel}
          </InkButton>
        </div>
      </div>
    </div>
  );
}
