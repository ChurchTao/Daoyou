import { requireAdminLoader } from '@app/lib/router/loaders';
import type { AdminLoaderData } from '@app/lib/router/routeData';
import { Outlet, useLoaderData } from 'react-router';
import { AdminShell } from './_components/AdminShell';

export const loader = requireAdminLoader;

export default function AdminLayout() {
  const { adminEmail } = useLoaderData() as AdminLoaderData;

  return (
    <AdminShell adminEmail={adminEmail}>
      <Outlet />
    </AdminShell>
  );
}
