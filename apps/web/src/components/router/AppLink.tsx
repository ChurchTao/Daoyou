import { resolveMapReturnHref } from '@app/lib/router/mapNavigation';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { Link, useLocation } from 'react-router';

type AppLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  children: ReactNode;
};

export default function AppLink({
  href,
  children,
  ...props
}: AppLinkProps) {
  const { state } = useLocation();
  return (
    <Link to={resolveMapReturnHref(href, state)} {...props}>
      {children}
    </Link>
  );
}
