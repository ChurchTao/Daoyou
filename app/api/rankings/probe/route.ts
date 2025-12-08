import {
  getCultivatorById,
  getCultivatorByIdUnsafe,
} from '@/lib/repositories/cultivatorRepository';
import { createClient } from '@/lib/supabase/server';
import { calculateFinalAttributes } from '@/utils/cultivatorUtils';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const { cultivatorId, targetId } = body;

    if (!cultivatorId || typeof cultivatorId !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的自身角色ID' },
        { status: 400 },
      );
    }

    if (!targetId || typeof targetId !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的目标角色ID' },
        { status: 400 },
      );
    }

    // 获取自身角色
    const selfCultivator = await getCultivatorById(user.id, cultivatorId);
    if (!selfCultivator) {
      return NextResponse.json(
        { error: '自身角色不存在或无权限' },
        { status: 404 },
      );
    }

    // 获取目标角色（跨用户，系统级回表）
    const targetRecord = await getCultivatorByIdUnsafe(targetId);
    if (!targetRecord) {
      return NextResponse.json(
        { error: '目标角色不存在或不可查探' },
        { status: 404 },
      );
    }
    const targetCultivator = targetRecord.cultivator;

    // 神识对比（使用最终属性中的意志/神识）
    const selfFinal = calculateFinalAttributes(selfCultivator).final;
    const targetFinal = calculateFinalAttributes(targetCultivator);

    if (selfFinal.willpower <= targetFinal.final.willpower) {
      return NextResponse.json(
        { error: '你的神识不足，未能窥破对方底细' },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        cultivator: targetCultivator,
        finalAttributes: targetFinal.final,
        attributeBreakdown: targetFinal.breakdown,
      },
    });
  } catch (error) {
    console.error('神识查探错误:', error);
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : '神识查探失败'
        : '神识查探失败，请稍后重试';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
