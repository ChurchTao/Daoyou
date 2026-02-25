import { withActiveCultivator } from '@/lib/api/withAuth';
import { getExecutor } from '@/lib/drizzle/db';
import { mails } from '@/lib/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

/**
 * POST /api/cultivator/mail/read-all
 * 全部标记为已读
 */
export const POST = withActiveCultivator(async (_request, { cultivator }) => {
  const q = getExecutor();

  const updatedRows = await q
    .update(mails)
    .set({ isRead: true })
    .where(and(eq(mails.cultivatorId, cultivator.id), eq(mails.isRead, false)))
    .returning({ id: mails.id });

  return NextResponse.json({
    success: true,
    updatedCount: updatedRows.length,
  });
});

