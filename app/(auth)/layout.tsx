import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * 认证区布局
 * - 简洁居中布局
 * - 无底部导航
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-paper flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md px-4">{children}</div>
    </div>
  );
}
