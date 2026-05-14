import { InkPageShell } from '@app/components/layout';
import type { ReactNode } from 'react';

interface AuthPageShellProps {
  title: string;
  lead: string;
  subtitle?: string;
  backHref?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export function AuthPageShell({
  title,
  lead,
  subtitle,
  backHref,
  footer,
  children,
}: AuthPageShellProps) {
  return (
    <InkPageShell
      title={title}
      subtitle={subtitle}
      lead={lead}
      backHref={backHref}
      showBottomNav={false}
    >
      <div className="mx-auto w-full max-w-md space-y-4">
        <section className="border-ink/18 border border-dashed p-5 bg-paper-color">
          <div className="space-y-4">{children}</div>
        </section>
        {footer ? <div className="text-center text-sm">{footer}</div> : null}
      </div>
    </InkPageShell>
  );
}
