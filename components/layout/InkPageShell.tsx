'use client';

import { cn } from '@/lib/cn';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { InkNav } from '../ui/InkDialog';

export interface InkPageShellProps {
  title: string;
  subtitle?: string;
  lead?: string;
  hero?: ReactNode;
  backHref?: string;
  note?: string;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  statusBar?: ReactNode;
  toolbar?: ReactNode;
  currentPath?: string;
  showBottomNav?: boolean;
  navItems?: Array<{ label: string; href: string }>;
}

/**
 * 页面壳组件
 * 提供统一的页面布局结构：头部、内容区、底部导航
 */
export function InkPageShell({
  title,
  subtitle,
  lead,
  hero,
  backHref,
  note,
  actions,
  children,
  footer,
  statusBar,
  toolbar,
  currentPath,
  showBottomNav = true,
  navItems,
}: InkPageShellProps) {
  const baseNav = navItems ?? [
    { label: '首页', href: '/' },
    { label: '储物袋', href: '/inventory' },
    { label: '道身', href: '/cultivator' },
    { label: '天骄榜', href: '/rankings' },
  ];

  return (
    <div className="bg-paper min-h-screen">
      <div className="mx-auto flex max-w-xl flex-col px-4 pb-24 pt-8">
        {/* 返回链接 */}
        {backHref && (
          <Link
            href={backHref}
            className="mb-4 text-ink transition hover:text-crimson no-underline"
          >
            [← 返回]
          </Link>
        )}

        {/* 页面头部 */}
        <header className="mb-6 text-center">
          {hero && <div className="mb-3 flex justify-center">{hero}</div>}
          <h1 className="text-3xl text-ink font-heading">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-base text-ink-secondary">{subtitle}</p>
          )}
          {lead && <p className="mt-3 text-lg text-ink">{lead}</p>}
          {note && <p className="mt-2 text-sm text-crimson/80">{note}</p>}
          {actions && (
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {actions}
            </div>
          )}
          {statusBar && <div className="mt-4">{statusBar}</div>}
        </header>

        {/* 工具栏 */}
        {toolbar && <div className="mb-4">{toolbar}</div>}

        {/* 主内容区 */}
        <div className="flex-1">{children}</div>

        {/* 页脚 */}
        {footer && <div className="mt-8">{footer}</div>}
      </div>

      {/* 底部导航 */}
      {showBottomNav && (
        <div
          className={cn(
            'fixed bottom-0 left-0 right-0 z-[100]',
            'bg-paper border-t border-ink/10',
          )}
        >
          <InkNav items={baseNav} currentPath={currentPath} />
        </div>
      )}
    </div>
  );
}
