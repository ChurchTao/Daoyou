import { AuthProvider } from '@app/lib/auth/authContext';
import { authLayoutLoader } from '@app/lib/router/loaders';
import { Outlet } from 'react-router';

export const loader = authLayoutLoader;

export default function AuthLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}
