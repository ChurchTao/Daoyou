'use client';

import { InkPageShell } from '@/components/layout';
import { Suspense } from 'react';
import { TechniquesView } from './components/TechniquesView';

/**
 * 功法页面
 */
export default function TechniquesPage() {
  return (
    <Suspense
      fallback={
        <InkPageShell title="加载中...">
          <div className="animate-pulse p-8 text-center">
            功法卷轴徐徐展开……
          </div>
        </InkPageShell>
      }
    >
      <TechniquesView />
    </Suspense>
  );
}
