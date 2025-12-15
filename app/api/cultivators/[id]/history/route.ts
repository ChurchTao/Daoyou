import {
  getCultivatorBreakthroughHistory,
  getCultivatorRetreatRecords,
} from '@/lib/repositories/cultivatorRepository';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id: cultivatorId } = await params;

    const [retreat_records, breakthrough_history] = await Promise.all([
      getCultivatorRetreatRecords(user.id, cultivatorId),
      getCultivatorBreakthroughHistory(user.id, cultivatorId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        retreat_records,
        breakthrough_history,
      },
    });
  } catch (error) {
    console.error('获取历史记录失败:', error);
    return NextResponse.json({ error: '获取历史记录失败' }, { status: 500 });
  }
}
