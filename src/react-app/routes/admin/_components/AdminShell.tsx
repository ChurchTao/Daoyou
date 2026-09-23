import Link from '@app/components/router/AppLink';
import { cn } from '@shared/lib/cn';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import { adminNavItems } from '../_config/nav';

interface AdminShellProps {
  adminEmail: string;
  adminUserId: string;
  children: ReactNode;
}

export function AdminShell({
  adminEmail,
  adminUserId,
  children,
}: AdminShellProps) {
  const { pathname } = useLocation();
  const isNavItemActive = (href: string) => {
    if (href === '/admin') {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const navigation = (
    <nav className="space-y-2">
      {adminNavItems.map((item) => {
        const active = isNavItemActive(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'block border px-3 py-2 no-underline transition-colors',
              active
                ? 'border-crimson/60 bg-crimson/8 text-ink'
                : 'text-ink-secondary hover:border-ink/20 hover:text-ink border-transparent',
            )}
          >
            <p className="font-semibold">{item.title}</p>
            <p className="mt-1 text-xs">{item.description}</p>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="bg-paper relative min-h-screen overflow-hidden">
      <div className="app-safe-area-page relative mx-auto flex w-full max-w-7xl flex-col gap-6 [--app-safe-area-block-space:1.5rem] lg:flex-row lg:[--app-safe-area-inline-space:2rem]">
        <aside className="border-ink/15 bg-bgpaper/90 w-full shrink-0 border border-dashed p-4 lg:sticky lg:top-[calc(env(safe-area-inset-top)+1.5rem)] lg:max-h-[calc(100dvh-3rem)] lg:w-72 lg:self-start lg:overflow-y-auto">
          <div className="border-ink/10 lg:mb-4 lg:border-b lg:pb-4">
            <p className="text-ink-secondary hidden text-xs tracking-[0.2em] lg:block">
              OPS CONSOLE
            </p>
            <h1 className="font-heading text-ink text-xl lg:mt-2 lg:text-3xl">
              万界司天台
            </h1>
            <p className="text-ink-secondary mt-2 hidden text-sm lg:block">
              {adminEmail}
            </p>
            <p className="text-ink-secondary/75 mt-1 hidden font-mono text-[11px] break-all lg:block">
              ID: {adminUserId}
            </p>
          </div>

          <div className="hidden lg:block">{navigation}</div>
          <details key={pathname} className="lg:hidden">
            <summary className="cursor-pointer py-2 text-sm">
              后台导航 ·{' '}
              {adminNavItems.find((item) => isNavItemActive(item.href))
                ?.title ?? '总览'}
            </summary>
            <div className="mt-3">{navigation}</div>
            <p className="text-ink-secondary mt-3 text-xs break-all">
              {adminEmail}
            </p>
          </details>

          <div className="mt-2 flex gap-3 text-sm lg:mt-6">
            <Link
              href="/game"
              className="border-ink/20 text-ink hover:border-crimson/40 hover:text-crimson border border-dashed px-2 py-1 no-underline"
            >
              返回游戏
            </Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
