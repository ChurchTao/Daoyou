import { db } from '@/lib/drizzle/db';
import { mails } from '@/lib/drizzle/schema';
import { createClient } from '@/lib/supabase/server';
import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ count: 0 });
  }

  // Get active cultivator
  const cultivator = await db.query.cultivators.findFirst({
    where: (cultivators, { eq, and }) =>
      and(eq(cultivators.userId, user.id), eq(cultivators.status, 'active')),
  });

  if (!cultivator) {
    return NextResponse.json({ count: 0 });
  }

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(mails)
    .where(and(eq(mails.cultivatorId, cultivator.id), eq(mails.isRead, false)));

  return NextResponse.json({ count: Number(result[0].count) });
}
