import { cn } from '@shared/lib/cn';
import { InkButton } from './InkButton';

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

const toastToneMeta: Record<
  InkToastTone,
  { borderClass: string; icon: string }
> = {
  default: { borderClass: 'border-ink/20', icon: '🕯️' },
  success: { borderClass: 'border-teal/40', icon: '✅' },
  warning: { borderClass: 'border-wood/45', icon: '⚠️' },
  danger: { borderClass: 'border-crimson/45', icon: '❗' },
};

export function InkToast({
  id,
  message,
  tone = 'default',
  actionLabel,
  onAction,
  onDismiss,
}: InkToastProps) {
  const toneMeta = toastToneMeta[tone];

  return (
    <div
      className={cn(
        'flex items-start gap-2 p-3 text-[0.9rem] leading-[1.6]',
        toneMeta.borderClass,
      )}
    >
      <span aria-hidden="true" className="shrink-0 pt-px">
        {toneMeta.icon}
      </span>
      <span className="min-w-0 flex-1">{message}</span>
      <div className="flex shrink-0 items-center gap-1">
        {actionLabel && onAction && (
          <InkButton
            variant="primary"
            onClick={onAction}
            className="px-0"
          >
            {actionLabel}
          </InkButton>
        )}
        <InkButton
          variant="ghost"
          onClick={() => onDismiss(id)}
          className="px-0"
        >
          撤去
        </InkButton>
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
        'fixed inset-x-3 bottom-20 z-200 flex flex-col gap-2',
        'md:left-1/2 md:right-auto md:w-[28rem] md:-translate-x-1/2',
      )}
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <InkToast key={toast.id} {...toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
