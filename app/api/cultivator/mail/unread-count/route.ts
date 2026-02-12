import { withActiveCultivator } from '@/lib/api/withAuth';
import { getExecutor } from '@/lib/drizzle/db';
import { mails } from '@/lib/drizzle/schema';
import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

/**
 * GET /api/cultivator/mail/unread-count
 * 获取当前活跃角色的未读邮件数量
 */
export const GET = withActiveCultivator(async (_req, { cultivator }) => {
  const q = getExecutor();
  const result = await q
    .select({ count: sql<number>`count(*)` })
    .from(mails)
    .where(and(eq(mails.cultivatorId, cultivator.id), eq(mails.isRead, false)));

  return NextResponse.json({ count: Number(result[0].count) });
});
