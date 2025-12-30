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
        'flex gap-2 py-2 border-b border-dashed border-ink/10',
        highlight && 'border-b-crimson/50',
        isColumn ? 'flex-col items-stretch' : 'justify-between',
      )}
    >
      {/* 主内容区 */}
      <div className={cn('flex-1 min-w-0', isColumn && 'w-full')}>
        {/* 标题行 */}
        <div className="font-semibold flex items-center gap-1 flex-wrap">
          <span>{title}</span>
          {newMark && (
            <span className="text-crimson font-semibold text-[0.875rem] ml-2">
              ← 新悟
            </span>
          )}
        </div>
        {/* 元信息 */}
        {meta && (
          <div className="text-[0.85rem] text-ink-secondary mt-1 whitespace-pre-line">
            {meta}
          </div>
        )}
        {/* 描述 */}
        {description && (
          <div className="text-[0.85rem] text-ink-secondary mt-1 whitespace-pre-line">
            {description}
          </div>
        )}
      </div>

      {/* 操作区 */}
      {actions && (
        <div
          className={cn(
            'flex items-center gap-1',
            isColumn && 'w-full justify-end pt-1 mt-1 flex-wrap',
          )}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
