'use client';

import { WelcomeRedirect } from '@/components/welcome/WelcomeRedirect';
import { Suspense } from 'react';
import { HomeView } from './components/HomeView';

/**
 * 首页
 * 重构后仅保留路由壳子
 */
export default function HomePage() {
  return (
    <WelcomeRedirect>
      <Suspense
        fallback={
          <div className="bg-paper min-h-screen flex items-center justify-center">
            <p className="loading-tip">正在推演天机……</p>
          </div>
        }
      >
        <HomeView />
      </Suspense>
    </WelcomeRedirect>
  );
}
