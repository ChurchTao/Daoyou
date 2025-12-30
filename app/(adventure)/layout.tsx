'use client';

import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import { createContext, useContext, type ReactNode } from 'react';

// 修仙者数据 Bundle 类型
type CultivatorBundle = ReturnType<typeof useCultivatorBundle>;

// 全局修仙者上下文（历练区也需要）
const CultivatorContext = createContext<CultivatorBundle | null>(null);

export function useCultivator(): CultivatorBundle {
  const context = useContext(CultivatorContext);
  if (!context) {
    throw new Error('useCultivator must be used within AdventureLayout');
  }
  return context;
}

/**
 * 历练探索区布局
 * - 沉浸式体验
 * - 底部导航可选显示
 */
export default function AdventureLayout({ children }: { children: ReactNode }) {
  const cultivatorBundle = useCultivatorBundle();

  return (
    <CultivatorContext.Provider value={cultivatorBundle}>
      <div className="bg-paper min-h-screen pb-20">{children}</div>
    </CultivatorContext.Provider>
  );
}
