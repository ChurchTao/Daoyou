import type { BattleEngineResult } from '@/engine/battle';
import { db } from '@/lib/drizzle/db';
import { battleRecords } from '@/lib/drizzle/schema';
import { getUserAliveCultivatorId } from '@/lib/repositories/cultivatorRepository';
import { createClient } from '@/lib/supabase/server';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(
    50,
    Math.max(1, Number(searchParams.get('pageSize') ?? '10')),
  );
  const offset = (page - 1) * pageSize;
  const type = searchParams.get('type'); // 'challenge' | 'challenged' | null (全部)
  const cultivatorId = await getUserAliveCultivatorId(user.id);
  console.log('cultivatorId', cultivatorId);

  if (!cultivatorId) {
    return NextResponse.json(
      { success: false, error: '未找到角色' },
      { status: 404 },
    );
  }

  // 构建查询条件
  let whereCondition = or(
    eq(battleRecords.cultivatorId, cultivatorId),
    eq(battleRecords.opponentCultivatorId, cultivatorId),
  );
  if (type === 'challenge') {
    whereCondition = and(
      eq(battleRecords.cultivatorId, cultivatorId),
      eq(battleRecords.challengeType, 'challenge'),
    )!;
  } else if (type === 'challenged') {
    whereCondition = and(
      eq(battleRecords.opponentCultivatorId, cultivatorId),
      eq(battleRecords.challengeType, 'challenged'),
    )!;
  }

  // 总数用于分页信息
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(battleRecords)
    .where(whereCondition);

  const total = Number(countRow?.count ?? 0);
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  const records = await db
    .select()
    .from(battleRecords)
    .where(whereCondition)
    .orderBy(desc(battleRecords.createdAt))
    .limit(pageSize)
    .offset(offset);

  // 仅返回列表页需要的精简数据
  const data = records.map((r) => {
    const result = r.battleResult as BattleEngineResult;
    return {
      id: r.id,
      createdAt: r.createdAt,
      winner: result.winner,
      loser: result.loser,
      turns: result.turns,
      challengeType: r.challengeType || 'normal',
      opponentCultivatorId: r.opponentCultivatorId,
    };
  });

  return NextResponse.json({
    success: true,
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  });
}
