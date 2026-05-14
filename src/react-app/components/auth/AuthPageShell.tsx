import { InkPageShell } from '@app/components/layout';
import { useAuth } from '@app/lib/auth/AuthContext';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';

interface AuthPageShellProps {
  title: string;
  lead: string;
  subtitle?: string;
  backHref?: string;
  footer?: ReactNode;
  children: ReactNode;
}

function AuthLoadingScreen({ message }: { message: string }) {
  return (
    <div className="bg-paper flex min-h-screen items-center justify-center">
      <p className="loading-tip">{message}</p>
    </div>
  );
}

export function AuthPageShell({
  title,
  lead,
  subtitle,
  backHref,
  footer,
  children,
}: AuthPageShellProps) {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      navigate('/game', { replace: true });
    }
  }, [isLoading, navigate, user]);

  if (isLoading || user) {
    return <AuthLoadingScreen message="神识感应中……" />;
  }

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
