import { db } from '@/lib/drizzle/db';
import { mails } from '@/lib/drizzle/schema';
import { createClient } from '@/lib/supabase/server';
import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get active cultivator
  const cultivator = await db.query.cultivators.findFirst({
    where: (cultivators, { eq, and }) =>
      and(eq(cultivators.userId, user.id), eq(cultivators.status, 'active')),
  });

  if (!cultivator) {
    return NextResponse.json(
      { error: 'No active cultivator' },
      { status: 404 },
    );
  }

  const userMails = await db.query.mails.findMany({
    where: eq(mails.cultivatorId, cultivator.id),
    orderBy: [desc(mails.createdAt)],
  });

  return NextResponse.json({ mails: userMails });
}
