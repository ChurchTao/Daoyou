import { isAdminEmail } from '@/lib/api/adminAuth';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminDashboard } from './AdminDashboard';

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  if (!isAdminEmail(user.email)) {
    redirect('/game');
  }

  return <AdminDashboard adminEmail={user.email ?? ''} />;
}
