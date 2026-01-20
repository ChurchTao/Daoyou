'use client';

import { Suspense } from 'react';
import { ManualDrawContent } from './ManualDrawContent';

export default function ManualDrawPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">加载中...</div>}>
      <ManualDrawContent />
    </Suspense>
  );
}
