'use client';

import { CultivatorProvider } from '@/lib/contexts/CultivatorContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

/**
 * 主游戏区布局
 * - 提供修仙者数据上下文
 */
export default function MainLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/enter');
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <p className="loading-tip">正在进入道界……</p>
      </div>
    );
  }

  return (
    <CultivatorProvider>
      <div className="bg-paper min-h-screen pb-20">{children}</div>
    </CultivatorProvider>
  );
}
