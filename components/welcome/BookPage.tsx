import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface BookPageProps {
  children: ReactNode;
  className?: string;
  showPageNumber?: boolean;
  pageNumber?: number;
}

/**
 * 古籍单页组件
 * 模拟古籍纸张效果
 */
export function BookPage({
  children,
  className,
  showPageNumber = false,
  pageNumber,
}: BookPageProps) {
  return (
    <div
      className={cn(
        'book-page relative min-h-screen w-full',
        'bg-paper',
        'border-l-4 border-amber-900/20',
        'shadow-xl',
        'px-6 py-12 md:px-12 md:py-16',
        className,
      )}
    >
      {/* 页面内容 */}
      <div className="relative z-10 max-w-2xl mx-auto">{children}</div>

      {/* 页码 */}
      {showPageNumber && pageNumber !== undefined && (
        <div className="absolute bottom-8 right-8 text-amber-900/40 text-sm">
          第{pageNumber}页
        </div>
      )}

      {/* 纸张边缘阴影 */}
      <div className="absolute inset-0 pointer-events-none shadow-inner border border-amber-900/5" />
    </div>
  );
}
