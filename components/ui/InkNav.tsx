'use client';

import { InkLink } from './InkLink';

export interface InkNavProps {
  items: Array<{ label: string; href: string }>;
  currentPath?: string;
}

export function InkNav({ items, currentPath }: InkNavProps) {
  return (
    <nav className="mx-auto flex max-w-xl items-center justify-around px-4 py-3">
      {items.map((item) => {
        const isActive = currentPath === item.href;
        return (
          <InkLink key={item.href} href={item.href} active={isActive}>
            {item.label}
          </InkLink>
        );
      })}
    </nav>
  );
}
