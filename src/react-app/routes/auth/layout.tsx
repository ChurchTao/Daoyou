import { AuthProvider } from '@app/lib/auth/AuthContext';
import { guestOnlyLoader } from '@app/lib/router/loaders';
import { Outlet } from 'react-router';

export const loader = guestOnlyLoader;

export default function AuthLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}
