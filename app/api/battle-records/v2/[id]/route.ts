import { getUserAliveCultivatorId } from '@/lib/services/cultivatorService';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getBattleRecordV2ByIdForCultivator } from '@/lib/repositories/battleRecordV2Repository';

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(req: Request, ctx: Params) {
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

  const cultivatorId = await getUserAliveCultivatorId(user.id);
  if (!cultivatorId) {
    return NextResponse.json(
      { success: false, error: '未找到角色' },
      { status: 404 },
    );
  }

  const { id } = await ctx.params;
  const record = await getBattleRecordV2ByIdForCultivator(id, cultivatorId);

  if (!record) {
    return NextResponse.json(
      { success: false, error: '记录不存在' },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      id: record.id,
      createdAt: record.createdAt,
      battleResult: record.battleResult,
      battleReport: record.battleReport,
    },
  });
}
