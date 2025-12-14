import { createTempCultivator } from '@/lib/repositories/cultivatorRepository';
import { createClient } from '@/lib/supabase/server';
import { shuffle } from '@/lib/utils';
import {
  generateCultivatorFromAI,
  validateAndAdjustCultivator,
} from '@/utils/characterEngine';
import { generatePreHeavenFates } from '@/utils/fateGenerator';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/generate-character
 * 生成角色
 */
export async function POST(request: NextRequest) {
  try {
    // 创建Supabase客户端，用于验证用户身份
    const supabase = await createClient();

    // 获取当前用户，验证用户身份
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const { userInput } = body;

    // 输入验证
    if (
      !userInput ||
      typeof userInput !== 'string' ||
      userInput.trim().length < 2 ||
      userInput.trim().length > 200
    ) {
      return NextResponse.json(
        { error: '道友请提供至少2~200字的角色描述' },
        { status: 400 },
      );
    }

    // 调用 characterEngine 生成角色
    const { cultivator: rawCultivator } =
      await generateCultivatorFromAI(userInput);

    // 使用角色生成引擎进行验证和修正
    const { cultivator: balancedCultivator, balanceNotes: engineNotes } =
      validateAndAdjustCultivator(rawCultivator);

    // We need to use 'let' if we want to reassign cultivator, but here we can just use a new variable name
    const cultivator = balancedCultivator;

    // 生成10个先天气运供玩家选择
    const preHeavenFates = await generatePreHeavenFates();
    // 气运打乱顺序
    const shuffledFates = shuffle(preHeavenFates);

    // 保存到临时表（包含角色和10个气运）
    const tempCultivatorId = await createTempCultivator(
      user.id,
      cultivator,
      preHeavenFates,
    );

    return NextResponse.json({
      success: true,
      data: {
        cultivator,
        preHeavenFates: shuffledFates,
        balanceNotes: engineNotes,
        tempCultivatorId,
      },
    });
  } catch (error) {
    console.error('生成角色 API 错误:', error);

    // 安全处理错误信息，避免泄露敏感信息
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : '生成角色失败，请稍后重试'
        : '生成角色失败，请稍后重试';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
