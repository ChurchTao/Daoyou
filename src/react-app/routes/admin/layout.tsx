import { useAuth } from '@app/lib/auth/AuthContext';
import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router';
import { AdminShell } from './_components/AdminShell';

type AdminSessionResponse = {
  success?: boolean;
  email?: string;
  error?: string;
};

export default function AdminLayout() {
  const { user, isLoading } = useAuth();
  const [adminEmail, setAdminEmail] = useState('');
  const [status, setStatus] = useState<
    'checking' | 'authenticated' | 'unauthenticated' | 'forbidden'
  >('checking');

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/api/admin/session', {
          cache: 'no-store',
        });
        const data = (await response.json()) as AdminSessionResponse;

        if (cancelled) return;

        if (response.status === 401) {
          setStatus('unauthenticated');
          return;
        }

        if (response.status === 403) {
          setStatus('forbidden');
          return;
        }

        if (!response.ok || !data.email) {
          throw new Error(data.error ?? '加载管理员会话失败');
        }

        setAdminEmail(data.email);
        setStatus('authenticated');
      } catch (error) {
        console.error('Load admin session error:', error);
        if (!cancelled) {
          setStatus('forbidden');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoading, user]);

  if (isLoading || status === 'checking') {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <p className="loading-tip">正在校验司天台符印……</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (status === 'forbidden') {
    return <Navigate to="/game" replace />;
  }

  return (
    <AdminShell adminEmail={adminEmail}>
      <Outlet />
    </AdminShell>
  );
}
