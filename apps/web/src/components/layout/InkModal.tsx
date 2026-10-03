import { cn } from '@app/lib/cn';
import { type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface InkModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
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
}: InkModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

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

  // 防止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center pt-[max(env(safe-area-inset-top),0.75rem)] pr-[max(env(safe-area-inset-right),0.75rem)] pb-[max(env(safe-area-inset-bottom),0.75rem)] pl-[max(env(safe-area-inset-left),0.75rem)] md:pt-[max(env(safe-area-inset-top),1rem)] md:pr-[max(env(safe-area-inset-right),1rem)] md:pb-[max(env(safe-area-inset-bottom),1rem)] md:pl-[max(env(safe-area-inset-left),1rem)]">
      {/* 遮罩层 */}
      <div className="ink-overlay absolute inset-0" onClick={onClose} />

      {/* 模态框内容 */}
      <div
        className={cn(
          'bg-bgpaper border-ink/20 relative z-10 w-full max-w-md border p-4 md:p-5',
          className,
        )}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <h3 className="text-ink font-heading text-center text-[1.35rem]">
            {title}
          </h3>
        )}

        <div
          className={cn(
            'battle-scroll max-h-[60vh] overflow-y-auto',
            title && 'mt-3',
          )}
        >
          {children}
        </div>

        {footer && (
          <div className="border-ink/15 mt-4 border-t border-dashed pt-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
