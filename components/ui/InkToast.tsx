'use client';

import { cn } from '@/lib/cn';

// ============ Toast Types ============

export type InkToastTone = 'default' | 'success' | 'warning' | 'danger';

export interface InkToastData {
  id: string;
  message: string;
  tone?: InkToastTone;
  actionLabel?: string;
  onAction?: () => void;
}

// ============ InkToast ============

interface InkToastProps extends InkToastData {
  onDismiss: (id: string) => void;
}

const toastBorderColors: Record<InkToastTone, string> = {
  default: 'border-ink/15',
  success: 'border-green-600/40',
  warning: 'border-amber-600/40',
  danger: 'border-red-700/50',
};

export function InkToast({
  id,
  message,
  tone = 'default',
  actionLabel,
  onAction,
  onDismiss,
}: InkToastProps) {
  return (
    <div
      className={cn(
        'bg-paper/95 border p-2 shadow-[0_4px_10px_rgba(0,0,0,0.1)]',
        'flex items-center justify-between gap-2 text-[0.9rem]',
        toastBorderColors[tone],
      )}
    >
      <span>{message}</span>
      <div className="flex gap-1">
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="text-crimson cursor-pointer border-none bg-transparent"
          >
            [{actionLabel}]
          </button>
        )}
        <button
          type="button"
          onClick={() => onDismiss(id)}
          className="text-crimson cursor-pointer border-none bg-transparent"
        >
          [撤去]
        </button>
      </div>
    </div>
  );
}

// ============ InkToastHost ============

export interface InkToastHostProps {
  toasts: InkToastData[];
  onDismiss: (id: string) => void;
}

export function InkToastHost({ toasts, onDismiss }: InkToastHostProps) {
  if (!toasts.length) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-20 left-1/2 z-200 -translate-x-1/2',
        'flex w-[min(90vw,420px)] flex-col gap-2',
      )}
    >
      {toasts.map((toast) => (
        <InkToast key={toast.id} {...toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
