import { isAdminEmail } from '@/lib/api/adminAuth';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminShell } from './_components/AdminShell';

export const metadata: Metadata = {
  title: '运营后台 | 万界道友',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
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

  return <AdminShell adminEmail={user.email ?? ''}>{children}</AdminShell>;
}
