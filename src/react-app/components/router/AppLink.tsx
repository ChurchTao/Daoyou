import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';

type AppLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  children: ReactNode;
};

export default function AppLink({
  href,
  children,
  ...props
}: AppLinkProps) {
  return (
    <Link to={href} {...props}>
      {children}
    </Link>
  );
}
