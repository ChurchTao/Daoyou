'use client';

import { Suspense } from 'react';
import { ManualDrawContent } from './ManualDrawContent';

export default function ManualDrawPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          加载中...
        </div>
      }
    >
      <ManualDrawContent />
    </Suspense>
  );
}
