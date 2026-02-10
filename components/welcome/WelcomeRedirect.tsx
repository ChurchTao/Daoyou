'use client';

import { useWelcomeStatus } from '@/lib/hooks/useWelcomeStatus';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * 首页重定向逻辑组件
 * 根据用户是否首次访问决定跳转到欢迎页或显示主页内容
 */
export function WelcomeRedirect({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isFirstVisit, skipWelcome, isLoading } = useWelcomeStatus();

  useEffect(() => {
    // 如果是首次访问且未选择跳过，跳转到欢迎页
    if (!isLoading && isFirstVisit && !skipWelcome) {
      router.push('/welcome');
    }
  }, [isFirstVisit, skipWelcome, isLoading, router]);

  // 加载中或即将跳转时显示加载状态
  if (isLoading || (isFirstVisit && !skipWelcome)) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <p className="loading-tip">正在推演天机……</p>
      </div>
    );
  }

  // 显示原始主页内容
  return <>{children}</>;
}
