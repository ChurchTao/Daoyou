'use client';

import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import { createContext, useContext, type ReactNode } from 'react';

// 修仙者数据 Bundle 类型
type CultivatorBundle = ReturnType<typeof useCultivatorBundle>;

// 全局修仙者上下文
const CultivatorContext = createContext<CultivatorBundle | null>(null);

/**
 * 使用修仙者上下文 Hook
 * 在 (main) 分组内的页面可直接使用，无需重复调用 useCultivatorBundle
 */
export function useCultivator(): CultivatorBundle {
  const context = useContext(CultivatorContext);
  if (!context) {
    throw new Error('useCultivator must be used within MainLayout');
  }
  return context;
}

/**
 * 主游戏区布局
 * - 提供修仙者数据上下文
 */
export default function MainLayout({ children }: { children: ReactNode }) {
  const cultivatorBundle = useCultivatorBundle();

  return (
    <CultivatorContext.Provider value={cultivatorBundle}>
      <div className="bg-paper min-h-screen pb-20">{children}</div>
    </CultivatorContext.Provider>
  );
}
