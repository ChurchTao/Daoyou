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
        <h2 className="text-ink font-heading mb-3 text-lg font-semibold">
          {title}
        </h2>
      )}
      <div className={cn(subdued && 'opacity-75')}>{children}</div>
      {hint && <p className="text-ink-secondary mt-2 text-sm">{hint}</p>}
    </section>
  );
}
