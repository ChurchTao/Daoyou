import { withActiveCultivator } from '@/lib/api/withAuth';
import { db } from '@/lib/drizzle/db';
import { dungeonHistories } from '@/lib/drizzle/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/dungeon/history
 * 获取副本历史记录（支持分页）
 *
 * Query Params:
 * - page: 页码（默认1）
 * - pageSize: 每页数量（默认10，最大50）
 */
export const GET = withActiveCultivator(
  async (request: NextRequest, { cultivator }) => {
    // 解析分页参数
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10)),
    );
    const offset = (page - 1) * pageSize;

    // 查询历史记录总数
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(dungeonHistories)
      .where(eq(dungeonHistories.cultivatorId, cultivator.id));

    const total = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(total / pageSize);

    // 查询历史记录
    const records = await db
      .select({
        id: dungeonHistories.id,
        theme: dungeonHistories.theme,
        result: dungeonHistories.result,
        log: dungeonHistories.log,
        realGains: dungeonHistories.realGains,
        createdAt: dungeonHistories.createdAt,
      })
      .from(dungeonHistories)
      .where(eq(dungeonHistories.cultivatorId, cultivator.id))
      .orderBy(desc(dungeonHistories.createdAt))
      .limit(pageSize)
      .offset(offset);

    return NextResponse.json({
      success: true,
      data: {
        records,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
        },
      },
    });
  },
);
