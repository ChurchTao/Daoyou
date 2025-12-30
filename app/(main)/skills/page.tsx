'use client';

import { InkPageShell } from '@/components/layout';
import { Suspense } from 'react';
import { SkillsView } from './components/SkillsView';

/**
 * 神通页面
 * 重构后仅保留路由壳子
 */
export default function SkillsPage() {
  return (
    <Suspense
      fallback={
        <InkPageShell title="加载中...">
          <div className="animate-pulse p-8 text-center">
            神通卷轴徐徐展开……
          </div>
        </InkPageShell>
      }
    >
      <SkillsView />
    </Suspense>
  );
}
