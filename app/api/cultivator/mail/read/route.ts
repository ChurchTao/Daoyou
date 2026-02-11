import { withActiveCultivator } from '@/lib/api/withAuth';
import { db } from '@/lib/drizzle/db';
import { mails } from '@/lib/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ReadMailSchema = z.object({
  mailId: z.string(),
});

/**
 * POST /api/cultivator/mail/read
 * 标记邮件为已读
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { cultivator }) => {
    const body = await request.json();
    const { mailId } = ReadMailSchema.parse(body);

    // Verify mail belongs to this cultivator
    const mail = await db().query.mails.findFirst({
      where: and(eq(mails.id, mailId), eq(mails.cultivatorId, cultivator.id)),
    });

    if (!mail) {
      return NextResponse.json({ error: 'Mail not found' }, { status: 404 });
    }

    await db().update(mails).set({ isRead: true }).where(eq(mails.id, mailId));

    return NextResponse.json({ success: true });
  },
);
