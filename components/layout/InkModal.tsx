'use client';

import { cn } from '@/lib/cn';
import { ReactNode, useEffect, useState } from 'react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 模态框内容 */}
      <div
        className={cn(
          'bg-paper w-full max-w-md rounded-xl shadow-2xl',
          'border-ink/30 relative z-10 border p-6',
          className,
        )}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <h3 className="text-ink font-heading text-center text-xl font-bold">
            {title}
          </h3>
        )}

        <div className="max-h-[50vh] overflow-y-auto">{children}</div>

        {footer}
      </div>
    </div>,
    document.body,
  );
}
