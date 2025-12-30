'use client';

import { InkNav } from '@/components/ui/InkNav';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import { usePathname } from 'next/navigation';
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

const navItems = [
  { label: '首页', href: '/' },
  { label: '储物袋', href: '/inventory' },
  { label: '道身', href: '/cultivator' },
  { label: '天骄榜', href: '/rankings' },
];

/**
 * 历练探索区布局
 * - 沉浸式体验
 * - 底部导航可选显示
 */
export default function AdventureLayout({ children }: { children: ReactNode }) {
  const cultivatorBundle = useCultivatorBundle();
  const pathname = usePathname();

  return (
    <CultivatorContext.Provider value={cultivatorBundle}>
      <div className="bg-paper min-h-screen pb-20">{children}</div>
      <div className="fixed bottom-0 left-0 right-0 z-100 bg-paper border-t border-ink/10 shadow">
        <InkNav items={navItems} currentPath={pathname} />
      </div>
    </CultivatorContext.Provider>
  );
}
