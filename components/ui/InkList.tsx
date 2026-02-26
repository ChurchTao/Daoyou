'use client';

import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

// ============ InkList ============

export interface InkListProps {
  children: ReactNode;
  dense?: boolean;
  className?: string;
}

/**
 * 列表容器组件
 */
export function InkList({
  children,
  dense = false,
  className = '',
}: InkListProps) {
  return (
    <div className={cn('flex flex-col', dense ? 'gap-1' : 'gap-2', className)}>
      {children}
    </div>
  );
}

// ============ InkListItem ============

export interface InkListItemProps {
  title: ReactNode;
  meta?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  highlight?: boolean;
  newMark?: boolean;
  layout?: 'row' | 'col';
}

/**
 * 列表项组件
 */
export function InkListItem({
  title,
  meta,
  description,
  actions,
  highlight = false,
  newMark = false,
  layout = 'row',
}: InkListItemProps) {
  const isColumn = layout === 'col';

  return (
    <div
      className={cn(
        'border-ink/10 flex gap-2 border-b border-dashed p-1',
        highlight && 'border-b-crimson/50 bg-crimson/5',
        isColumn ? 'flex-col items-stretch' : 'justify-between',
      )}
    >
      {/* 主内容区 */}
      <div className={cn('min-w-0 flex-1', isColumn && 'w-full')}>
        {/* 标题行 */}
        <div className="flex flex-wrap items-center gap-1 font-semibold">
          <span>{title}</span>
          {newMark && (
            <span className="text-crimson ml-2 text-[0.875rem] font-semibold">
              ← 新悟
            </span>
          )}
        </div>
        {/* 元信息 */}
        {meta && (
          <div className="text-ink-secondary mt-1 text-[0.85rem] whitespace-pre-line">
            {meta}
          </div>
        )}
        {/* 描述 */}
        {description && (
          <div className="text-ink-secondary mt-1 text-[0.85rem] whitespace-pre-line">
            {description}
          </div>
        )}
      </div>

      {/* 操作区 */}
      {actions && (
        <div
          className={cn(
            'flex items-center gap-1',
            isColumn && 'mt-1 w-full flex-wrap justify-end pt-1',
          )}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
