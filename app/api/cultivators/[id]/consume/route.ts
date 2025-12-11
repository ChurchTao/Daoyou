import { consumeItem } from '@/lib/repositories/cultivatorRepository';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/cultivators/:id/consume
 * 使用消耗品
 */
export async function POST(
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
    const body = await request.json();
    const { consumableId } = body;

    if (!cultivatorId || !consumableId) {
      return NextResponse.json(
        { error: '参数不完整 (cultivatorId, consumableId)' },
        { status: 400 },
      );
    }

    const result = await consumeItem(user.id, cultivatorId, consumableId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('使用物品失败:', error);
    const errorMessage =
      error instanceof Error ? error.message : '使用物品失败，请稍后重试';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
