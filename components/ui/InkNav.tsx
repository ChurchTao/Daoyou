'use client';

import { InkLink } from './InkLink';

export interface InkNavProps {
  items: Array<{ label: string; href: string }>;
  currentPath?: string;
}

export function InkNav({ items, currentPath }: InkNavProps) {
  return (
    <nav className="flex justify-around items-center px-4 py-3 max-w-xl mx-auto">
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
