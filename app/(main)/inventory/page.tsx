'use client';

import { InkPageShell } from '@/components/layout';
import { Suspense } from 'react';
import { InventoryView } from './components/InventoryView';

/**
 * 储物袋页面
 * 重构后仅保留路由壳子
 */
export default function InventoryPage() {
  return (
    <Suspense
      fallback={
        <InkPageShell title="加载中...">
          <div className="animate-pulse p-8 text-center">储物袋开启中……</div>
        </InkPageShell>
      }
    >
      <InventoryView />
    </Suspense>
  );
}
