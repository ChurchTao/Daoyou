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

  return (
    <div className="relative min-h-screen overflow-hidden bg-paper">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(193,18,31,0.1),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(90,74,66,0.12),transparent_50%)]" />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:px-8">
        <aside className="w-full shrink-0 rounded-xl border border-ink/15 bg-paper/90 p-4 backdrop-blur lg:sticky lg:top-6 lg:w-72 lg:self-start">
          <div className="mb-4 border-b border-ink/10 pb-4">
            <p className="text-xs tracking-[0.2em] text-ink-secondary">
              OPS CONSOLE
            </p>
            <h1 className="mt-2 font-heading text-3xl text-ink">万界司天台</h1>
            <p className="mt-2 text-sm text-ink-secondary">{adminEmail}</p>
          </div>

          <nav className="space-y-2">
            {adminNavItems.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'block rounded-lg border px-3 py-2 transition-colors no-underline',
                    active
                      ? 'border-crimson/60 bg-crimson/8 text-ink'
                      : 'border-transparent text-ink-secondary hover:border-ink/20 hover:text-ink',
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
              className="rounded border border-ink/20 px-2 py-1 text-ink no-underline hover:border-crimson/40 hover:text-crimson"
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
