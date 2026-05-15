import { cn } from '@shared/lib/cn';
import Link from '@app/components/router/AppLink';
import type { ReactNode } from 'react';

export interface InkLinkProps {
  children: ReactNode;
  href: string;
  className?: string;
  active?: boolean;
}

export function InkLink({
  children,
  href,
  className = '',
  active = false,
}: InkLinkProps) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'text-ink inline-flex items-center px-1.5 py-1 no-underline transition-colors duration-150',
        'hover:text-crimson',
        active && 'ink-emphasis text-crimson font-semibold',
        className,
      )}
    >
      [{children}]
    </Link>
  );
}
