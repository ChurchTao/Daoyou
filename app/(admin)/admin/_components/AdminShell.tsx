'use client';

import { cn } from '@/lib/cn';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { adminNavItems } from '../_config/nav';

interface AdminShellProps {
  adminEmail: string;
  children: ReactNode;
}

export function AdminShell({ adminEmail, children }: AdminShellProps) {
  const pathname = usePathname();
  const isNavItemActive = (href: string) => {
    if (href === '/admin') {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="bg-paper relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(193,18,31,0.1),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(90,74,66,0.12),transparent_50%)]" />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:px-8">
        <aside className="border-ink/15 bg-paper/90 w-full shrink-0 rounded-xl border p-4 backdrop-blur lg:sticky lg:top-6 lg:w-72 lg:self-start">
          <div className="border-ink/10 mb-4 border-b pb-4">
            <p className="text-ink-secondary text-xs tracking-[0.2em]">
              OPS CONSOLE
            </p>
            <h1 className="font-heading text-ink mt-2 text-3xl">万界司天台</h1>
            <p className="text-ink-secondary mt-2 text-sm">{adminEmail}</p>
          </div>

          <nav className="space-y-2">
            {adminNavItems.map((item) => {
              const active = isNavItemActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'block rounded-lg border px-3 py-2 no-underline transition-colors',
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

          <div className="mt-6 flex gap-3 text-sm">
            <Link
              href="/game"
              className="border-ink/20 text-ink hover:border-crimson/40 hover:text-crimson rounded border px-2 py-1 no-underline"
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
