'use client';

import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

export interface InkSectionProps {
  title: ReactNode;
  children: ReactNode;
  hint?: string;
  subdued?: boolean;
}

/**
 * 区块标题组件
 * 用于页面内容分区
 */
export function InkSection({
  title,
  children,
  hint,
  subdued = false,
}: InkSectionProps) {
  return (
    <section className="mb-6">
      {title && (
        <h2 className="text-lg font-semibold text-ink mb-3 font-heading">
          {title}
        </h2>
      )}
      <div className={cn(subdued && 'opacity-75')}>{children}</div>
      {hint && <p className="mt-2 text-sm text-ink-secondary">{hint}</p>}
    </section>
  );
}
