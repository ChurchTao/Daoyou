'use client';

import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import { createContext, useContext, type ReactNode } from 'react';

// 修仙者数据 Bundle 类型
type CultivatorBundle = ReturnType<typeof useCultivatorBundle>;

// 全局修仙者上下文
const CultivatorContext = createContext<CultivatorBundle | null>(null);

/**
 * 使用修仙者上下文 Hook
 * 在 (main) 分组内的页面可直接使用
 * @throws 如果在 CultivatorProvider 外部使用会抛出错误
 */
export function useCultivator(): CultivatorBundle {
  const context = useContext(CultivatorContext);
  if (!context) {
    throw new Error('useCultivator must be used within CultivatorProvider');
  }
  return context;
}

/**
 * 修仙者数据 Provider
 * 提供全局唯一的修仙者数据源
 */
export function CultivatorProvider({ children }: { children: ReactNode }) {
  const cultivatorBundle = useCultivatorBundle();

  return (
    <CultivatorContext.Provider value={cultivatorBundle}>
      {children}
    </CultivatorContext.Provider>
  );
}
