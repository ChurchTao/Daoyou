'use client';

import { WelcomeFlow } from '@/components/welcome/WelcomeFlow';
import { useWelcomeStatus } from '@/lib/hooks/useWelcomeStatus';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * 欢迎页面路由
 * 展示古籍翻页式开场动画
 */
export default function WelcomePage() {
  const router = useRouter();
  const { skipWelcome, isLoading } = useWelcomeStatus();

  // 如果用户选择跳过，直接跳转到主页
  useEffect(() => {
    if (!isLoading && skipWelcome) {
      router.replace('/game');
    }
  }, [skipWelcome, isLoading, router]);

  // 加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50">
        <p className="text-amber-800/60 text-lg animate-pulse">
          正在推演天机……
        </p>
      </div>
    );
  }

  // 显示欢迎流程
  return <WelcomeFlow />;
}
