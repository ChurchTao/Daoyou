import {
  checkAndIncrementReroll,
  saveTempFates,
} from '@/lib/repositories/redisCultivatorRepository';
import { createClient } from '@/lib/supabase/server';
import { shuffle } from '@/lib/utils';
import { generatePreHeavenFates } from '@/utils/fateGenerator';
import { NextRequest, NextResponse } from 'next/server';

const MAX_REROLLS = 3;

/**
 * POST /api/generate-fates
 * 生成先天气运
 */
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
    const { tempId } = body;

    if (!tempId) {
      return NextResponse.json({ error: '缺少临时角色ID' }, { status: 400 });
    }

    // 检查重随次数
    const { allowed, remaining } = await checkAndIncrementReroll(
      tempId,
      MAX_REROLLS,
    );

    if (!allowed) {
      return NextResponse.json(
        { error: '气运重随次数已用尽' },
        { status: 400 },
      );
    }

    const allFates = await generatePreHeavenFates(6);
    const shuffledFates = shuffle(allFates).slice(0, 6);

    // 保存到Redis
    await saveTempFates(tempId, shuffledFates);

    return NextResponse.json({
      success: true,
      data: {
        fates: shuffledFates,
        remainingRerolls: remaining,
      },
    });
  } catch (error) {
    console.error('生成气运 API 错误:', error);
    return NextResponse.json(
      { error: '生成气运失败，请稍后重试' },
      { status: 500 },
    );
  }
}
