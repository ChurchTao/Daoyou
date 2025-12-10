import { createTempCultivator } from '@/lib/repositories/cultivatorRepository';
import { createClient } from '@/lib/supabase/server';
import { text } from '@/utils/aiClient';
import { validateAndAdjustCultivator } from '@/utils/characterEngine';
import { createCultivatorFromAI } from '@/utils/cultivatorUtils';
import { generatePreHeavenFates } from '@/utils/fateGenerator';
import { getCharacterGenerationPrompt } from '@/utils/prompts';
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
      userInput.trim().length < 5
    ) {
      return NextResponse.json(
        { error: '请提供至少5个字符的角色描述' },
        { status: 400 },
      );
    }

    // 生成 prompt
    const prompt = getCharacterGenerationPrompt();

    // 调用 AI 生成角色
    const aiResponse = await text(prompt, userInput);

    // 解析AI响应，创建角色对象
    let cultivator = createCultivatorFromAI(aiResponse.text, userInput);

    // 使用角色生成引擎进行验证和修正
    const { cultivator: balancedCultivator, balanceNotes } =
      validateAndAdjustCultivator(cultivator);
    cultivator = balancedCultivator;

    // 生成10个先天气运供玩家选择
    const preHeavenFates = await generatePreHeavenFates(userInput);

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
        preHeavenFates, // 返回10个气运供前端选择
        balanceNotes,
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
