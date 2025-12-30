import type { ReactNode } from 'react';

/**
 * 认证区布局
 * - 简洁居中布局
 * - 无底部导航
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-paper min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full px-4">{children}</div>
    </div>
  );
}
