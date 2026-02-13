import type { BattleEngineResult } from '@/engine/battle';
import { getExecutor } from '@/lib/drizzle/db';
import { battleRecords } from '@/lib/drizzle/schema';
import { getUserAliveCultivatorId } from '@/lib/services/cultivatorService';
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

  if (!cultivatorId) {
    return NextResponse.json(
      { success: false, error: '未找到角色' },
      { status: 404 },
    );
  }

  // 基础条件：我参与的战斗
  const participantCondition = or(
    eq(battleRecords.cultivatorId, cultivatorId),
    eq(battleRecords.opponentCultivatorId, cultivatorId),
  );

  // 按“当前角色视角”筛选挑战类型
  let whereCondition = participantCondition;
  if (type === 'challenge') {
    whereCondition = and(
      participantCondition,
      eq(battleRecords.cultivatorId, cultivatorId),
    )!;
  } else if (type === 'challenged') {
    whereCondition = and(
      participantCondition,
      eq(battleRecords.opponentCultivatorId, cultivatorId),
    )!;
  }

  // 总数用于分页信息
  const [countRow] = await getExecutor()
    .select({ count: sql<number>`count(*)` })
    .from(battleRecords)
    .where(whereCondition);

  const total = Number(countRow?.count ?? 0);
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  const records = await getExecutor()
    .select()
    .from(battleRecords)
    .where(whereCondition)
    .orderBy(desc(battleRecords.createdAt))
    .limit(pageSize)
    .offset(offset);

  // 仅返回列表页需要的精简数据
  const data = records.map((r) => {
    const result = r.battleResult as BattleEngineResult;
    const isChallenger = r.cultivatorId === cultivatorId;
    const hasOpponent = !!r.opponentCultivatorId;

    const challengeType = hasOpponent
      ? isChallenger
        ? 'challenge'
        : 'challenged'
      : 'normal';

    return {
      id: r.id,
      createdAt: r.createdAt,
      winner: result.winner,
      loser: result.loser,
      turns: result.turns,
      challengeType,
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
