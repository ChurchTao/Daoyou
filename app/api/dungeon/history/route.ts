import { db } from '@/lib/drizzle/db';
import { cultivators, dungeonHistories } from '@/lib/drizzle/schema';
import { createClient } from '@/lib/supabase/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/dungeon/history
 * 获取副本历史记录（支持分页）
 *
 * Query Params:
 * - page: 页码（默认1）
 * - pageSize: 每页数量（默认10，最大50）
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 },
      );
    }

    // 2. 解析分页参数
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10)),
    );
    const offset = (page - 1) * pageSize;

    // 3. 获取用户的活跃角色 ID
    const userCultivators = await db
      .select({ id: cultivators.id })
      .from(cultivators)
      .where(
        and(eq(cultivators.userId, user.id), eq(cultivators.status, 'active')),
      )
      .limit(1);

    if (userCultivators.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          records: [],
          pagination: {
            page,
            pageSize,
            total: 0,
            totalPages: 0,
          },
        },
      });
    }

    const cultivatorId = userCultivators[0].id;

    // 4. 查询历史记录总数
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(dungeonHistories)
      .where(eq(dungeonHistories.cultivatorId, cultivatorId));

    const total = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(total / pageSize);

    // 5. 查询历史记录
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
      .where(eq(dungeonHistories.cultivatorId, cultivatorId))
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
  } catch (error) {
    console.error('[Dungeon History API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取历史记录失败',
      },
      { status: 500 },
    );
  }
}
