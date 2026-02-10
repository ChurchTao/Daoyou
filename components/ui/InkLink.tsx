'use client';

import { cn } from '@/lib/cn';
import Link from 'next/link';
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
      className={cn(
        'text-ink inline-block px-2 py-2 no-underline transition-colors',
        'hover:text-crimson',
        active && 'text-crimson font-semibold',
        className,
      )}
    >
      {active ? `【${children}】` : `[${children}]`}
    </Link>
  );
}
