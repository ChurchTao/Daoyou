import type { BattleEngineResult } from '@/engine/battleEngine';
import { db } from '@/lib/drizzle/db';
import { battleRecords } from '@/lib/drizzle/schema';
import { createClient } from '@/lib/supabase/server';
import { desc, eq, sql } from 'drizzle-orm';
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

  // 总数用于分页信息
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(battleRecords)
    .where(eq(battleRecords.userId, user.id));

  const total = Number(countRow?.count ?? 0);
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  const records = await db
    .select()
    .from(battleRecords)
    .where(eq(battleRecords.userId, user.id))
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
