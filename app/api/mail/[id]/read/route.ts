import { db } from '@/lib/drizzle/db';
import { mails } from '@/lib/drizzle/schema';
import { createClient } from '@/lib/supabase/server';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify ownership via cultivator (indirectly) or just check mail->cultivator->user
  // But mails table has cultivatorId, not userId.
  // So we fetch the mail and check its cultivator's userId.

  const mail = await db.query.mails.findFirst({
    where: eq(mails.id, id),
    with: {
      // We need to verify the cultivator belongs to the user.
      // But drizzle query builder 'with' relational queries require defined relations in schema/relations.ts
      // If relations aren't defined, we do a join or separate query.
      // Assuming relations might not be set up for quick access, let's just fetch cultivator.
    },
  });

  if (!mail) {
    return NextResponse.json({ error: 'Mail not found' }, { status: 404 });
  }

  // Check cultivator ownership
  const cultivator = await db.query.cultivators.findFirst({
    where: eq(cultivators.id, mail.cultivatorId),
  });

  // Need to import cultivators

  if (!cultivator || cultivator.userId !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  await db.update(mails).set({ isRead: true }).where(eq(mails.id, id));

  return NextResponse.json({ success: true });
}

import { cultivators } from '@/lib/drizzle/schema';
