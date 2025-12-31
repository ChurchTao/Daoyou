import { withActiveCultivator } from '@/lib/api/withAuth';
import { db } from '@/lib/drizzle/db';
import { mails } from '@/lib/drizzle/schema';
import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

/**
 * GET /api/cultivator/mail
 * 获取当前活跃角色的邮件列表
 */
export const GET = withActiveCultivator(async (_req, { cultivator }) => {
  const userMails = await db.query.mails.findMany({
    where: eq(mails.cultivatorId, cultivator.id),
    orderBy: [desc(mails.createdAt)],
  });

  return NextResponse.json({ mails: userMails });
});
