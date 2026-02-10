import type { ReactNode } from 'react';

/**
 * Admin route group layout
 * Keeps admin pages isolated from website/info route groups.
 */
export default function AdminRouteGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="bg-paper min-h-screen">{children}</div>;
}
