'use client';

import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface InkModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

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
    // Small delay to ensure client-side only and avoid synchronous update warning
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  // Close on Escape key
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

  // Prevent body scroll when open
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        className={`bg-paper max-w-md w-full rounded-xl shadow-2xl border-2 border-primary/30 p-6 relative animate-in zoom-in-95 duration-200 z-10 ${className}`}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <h3 className="text-xl font-bold text-center mb-4 text-primary">
            {title}
          </h3>
        )}

        <div className="max-h-[70vh] overflow-y-auto mb-6 custom-scrollbar">
          {children}
        </div>

        {footer}
      </div>
    </div>,
    document.body,
  );
}
