import { withActiveCultivator } from '@/lib/api/withAuth';
import { getExecutor } from '@/lib/drizzle/db';
import { mails } from '@/lib/drizzle/schema';
import { desc, eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/cultivator/mail
 * 获取当前活跃角色的邮件列表（分页）
 *
 * Query Params:
 * - page: 页码（默认 1）
 * - pageSize: 每页数量（默认 20，最大 100）
 */
export const GET = withActiveCultivator(async (req: NextRequest, { cultivator }) => {
  const searchParams = req.nextUrl.searchParams;
  const pageRaw = parseInt(searchParams.get('page') || '1', 10);
  const pageSizeRaw = parseInt(searchParams.get('pageSize') || '20', 10);
  const page = Number.isNaN(pageRaw) ? 1 : Math.max(1, pageRaw);
  const pageSize = Number.isNaN(pageSizeRaw)
    ? 20
    : Math.min(100, Math.max(1, pageSizeRaw));
  const offset = (page - 1) * pageSize;

  const q = getExecutor();
  const userMails = await q.query.mails.findMany({
    where: eq(mails.cultivatorId, cultivator.id),
    orderBy: [desc(mails.createdAt)],
    limit: pageSize + 1,
    offset,
  });
  const hasMore = userMails.length > pageSize;
  const pagedMails = hasMore ? userMails.slice(0, pageSize) : userMails;

  return NextResponse.json({
    mails: pagedMails,
    pagination: {
      page,
      pageSize,
      hasMore,
    },
  });
});
