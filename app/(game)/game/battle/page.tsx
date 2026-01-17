'use client';

import { Suspense } from 'react';
import { BattleView } from './components/BattleView';

/**
 * 对战播报页
 * 重构后仅保留路由壳子
 */
export default function BattlePage() {
  return (
    <Suspense
      fallback={
        <div className="bg-paper min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-ink">加载中...</p>
          </div>
        </div>
      }
    >
      <BattleView />
    </Suspense>
  );
}
