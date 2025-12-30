import type { ReactNode } from 'react';

/**
 * 信息展示区布局
 * - 简洁布局
 * - 无底部导航
 */
export default function InfoLayout({ children }: { children: ReactNode }) {
  return <div className="bg-paper min-h-screen">{children}</div>;
}
