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
        'fixed inset-0 z-[300] flex items-center justify-center p-4',
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

function InkToast({
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
        'flex justify-between gap-2 items-center text-[0.9rem]',
        toastBorderColors[tone],
      )}
    >
      <span>{message}</span>
      <div className="flex gap-1">
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="text-crimson cursor-pointer bg-transparent border-none"
          >
            [{actionLabel}]
          </button>
        )}
        <button
          type="button"
          onClick={() => onDismiss(id)}
          className="text-crimson cursor-pointer bg-transparent border-none"
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
        'fixed bottom-20 left-1/2 -translate-x-1/2 z-[200]',
        'flex flex-col gap-2 w-[min(90vw,420px)]',
      )}
    >
      {toasts.map((toast) => (
        <InkToast key={toast.id} {...toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ============ InkTabs ============

export interface InkTabItem {
  label: ReactNode;
  value: string;
}

export interface InkTabsProps {
  items: InkTabItem[];
  activeValue: string;
  onChange: (value: string) => void;
  className?: string;
}

export function InkTabs({
  items,
  activeValue,
  onChange,
  className = '',
}: InkTabsProps) {
  return (
    <div className={cn('flex gap-2 border-b border-ink/10', className)}>
      {items.map((item) => {
        const isActive = activeValue === item.value;
        return (
          <button
            key={item.value}
            onClick={() => onChange(item.value)}
            className={cn(
              'px-4 py-2 text-base transition-colors',
              isActive
                ? 'border-b-2 border-crimson text-crimson'
                : 'text-ink/60 hover:text-ink',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

// ============ InkLink ============

import Link from 'next/link';

export interface InkLinkProps {
  children: ReactNode;
  href: string;
  className?: string;
  active?: boolean;
}

export function InkLink({
  children,
  href,
  className = '',
  active = false,
}: InkLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        'text-ink no-underline px-2 py-2 transition-colors inline-block',
        'hover:text-crimson',
        active && 'text-crimson font-semibold',
        className,
      )}
    >
      {active ? `【${children}】` : `[${children}]`}
    </Link>
  );
}

// ============ InkNav ============

export interface InkNavProps {
  items: Array<{ label: string; href: string }>;
  currentPath?: string;
}

export function InkNav({ items, currentPath }: InkNavProps) {
  return (
    <nav className="flex justify-around items-center px-4 py-3 max-w-xl mx-auto">
      {items.map((item) => {
        const isActive = currentPath === item.href;
        return (
          <InkLink key={item.href} href={item.href} active={isActive}>
            {item.label}
          </InkLink>
        );
      })}
    </nav>
  );
}
