import type { ReactNode } from 'react';
import Link from 'next/link';

interface InkPageShellProps {
  title: string;
  subtitle?: string;
  lead?: string;
  backHref?: string;
  note?: string;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

interface InkSectionProps {
  title: string;
  children: ReactNode;
  hint?: string;
  subdued?: boolean;
}

export function InkPageShell({
  title,
  subtitle,
  lead,
  backHref,
  note,
  actions,
  children,
  footer,
}: InkPageShellProps) {
  return (
    <div className="bg-paper min-h-screen">
      <div className="mx-auto flex max-w-xl flex-col px-4 pb-16 pt-8 main-content">
        {backHref && (
          <Link
            href={backHref}
            className="mb-4 text-ink transition hover:text-crimson"
          >
            [← 返回]
          </Link>
        )}

        <header className="mb-6 text-center">
          <h1 className="font-ma-shan-zheng text-3xl text-ink">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-base text-ink-secondary">{subtitle}</p>
          )}
          {lead && <p className="mt-3 text-lg text-ink">{lead}</p>}
          {note && (
            <p className="mt-2 text-sm text-crimson/80">
              {note}
            </p>
          )}
          {actions && <div className="mt-4 flex flex-wrap justify-center gap-3">{actions}</div>}
        </header>

        <div className="flex-1">{children}</div>

        {footer && <div className="mt-8">{footer}</div>}
      </div>
    </div>
  );
}

export function InkSection({ title, children, hint, subdued = false }: InkSectionProps) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div
        className={`mt-3 rounded-lg border border-ink/10 ${
          subdued ? 'bg-white/60' : 'bg-paper-light'
        } p-4 shadow-sm`}
      >
        {children}
      </div>
      {hint && <p className="mt-2 text-sm text-ink-secondary">{hint}</p>}
    </section>
  );
}

