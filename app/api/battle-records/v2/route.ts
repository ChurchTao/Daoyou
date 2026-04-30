import { getUserAliveCultivatorId } from '@/lib/services/cultivatorService';
import { createClient } from '@/lib/supabase/server';
import {
  listBattleRecordV2Summaries,
  type ListBattleRecordV2Input,
} from '@/lib/repositories/battleRecordV2Repository';
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
  const typeParam = searchParams.get('type');
  const type: ListBattleRecordV2Input['type'] =
    typeParam === 'challenge' || typeParam === 'challenged' ? typeParam : null;

  const cultivatorId = await getUserAliveCultivatorId(user.id);
  if (!cultivatorId) {
    return NextResponse.json(
      { success: false, error: '未找到角色' },
      { status: 404 },
    );
  }

  const result = await listBattleRecordV2Summaries({
    cultivatorId,
    page,
    pageSize,
    type,
  });

  return NextResponse.json({
    success: true,
    data: result.data,
    pagination: {
      page,
      pageSize,
      total: result.total,
      totalPages: result.totalPages,
    },
  });
}
