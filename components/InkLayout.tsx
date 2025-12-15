import Link from 'next/link';
import type { ReactNode } from 'react';
import { InkNav } from './InkComponents';

interface InkPageShellProps {
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

interface InkSectionProps {
  title: ReactNode;
  children: ReactNode;
  hint?: string;
  subdued?: boolean;
}

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
      <div className="mx-auto flex max-w-xl flex-col px-4 pb-24 pt-8 main-content">
        {backHref && (
          <Link
            href={backHref}
            className="mb-4 text-ink transition hover:text-crimson"
          >
            [← 返回]
          </Link>
        )}

        <header className="mb-6 text-center">
          {hero && <div className="mb-3 flex justify-center">{hero}</div>}
          <h1 className="text-3xl text-ink">{title}</h1>
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

        {toolbar && <div className="mb-4">{toolbar}</div>}

        <div className="flex-1">{children}</div>

        {footer && <div className="mt-8">{footer}</div>}
      </div>
      {showBottomNav && (
        <div className="ink-shell-bottom">
          <InkNav items={baseNav} currentPath={currentPath} />
        </div>
      )}
    </div>
  );
}

export function InkSection({
  title,
  children,
  hint,
  subdued = false,
}: InkSectionProps) {
  return (
    <section className="mb-6">
      {title && (
        <h2 className="text-lg font-semibold text-ink mb-3">{title}</h2>
      )}
      <div className={subdued ? 'opacity-75' : ''}>{children}</div>
      {hint && <p className="mt-2 text-sm text-ink-secondary">{hint}</p>}
    </section>
  );
}
