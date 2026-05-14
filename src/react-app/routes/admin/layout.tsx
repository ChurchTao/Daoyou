import type { AdminLoaderData } from '@app/lib/router/loaders';
import { Outlet, useLoaderData } from 'react-router';
import { AdminShell } from './_components/AdminShell';

export default function AdminLayout() {
  const { adminEmail } = useLoaderData() as AdminLoaderData;

  return (
    <AdminShell adminEmail={adminEmail}>
      <Outlet />
    </AdminShell>
  );
}
