import { CultivatorProvider } from '@/lib/contexts/CultivatorContext';
import type { ReactNode } from 'react';

/**
 * 主游戏区布局
 * - 提供修仙者数据上下文
 */
export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <CultivatorProvider>
      <div className="bg-paper min-h-screen pb-20">{children}</div>
    </CultivatorProvider>
  );
}
