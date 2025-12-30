'use client';

import { InkPageShell } from '@/components/layout';
import { Suspense } from 'react';
import { RetreatView } from './components/RetreatView';

/**
 * 洞府页面
 * 重构后仅保留路由壳子
 */
export default function RetreatPage() {
  return (
    <Suspense
      fallback={
        <InkPageShell title="加载中...">
          <div className="animate-pulse p-8 text-center">洞府封闭中……</div>
        </InkPageShell>
      }
    >
      <RetreatView />
    </Suspense>
  );
}
