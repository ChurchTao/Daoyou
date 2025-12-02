import { createTempCultivator } from '@/lib/repositories/cultivatorRepository';
import { createClient } from '@/lib/supabase/server';
import { createCultivatorFromAI } from '@/utils/cultivatorUtils';
import { NextRequest, NextResponse } from 'next/server';
import { generateCharacter } from '../../../utils/aiClient';
import { getCharacterGenerationPrompt } from '../../../utils/prompts';

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
    const aiResponse = await generateCharacter(prompt, userInput);

    // 解析AI响应，创建角色对象
    const cultivator = createCultivatorFromAI(aiResponse, userInput);

    // 保存到临时表
    const tempCultivatorId = await createTempCultivator(user.id, cultivator);

    return NextResponse.json({
      success: true,
      data: {
        cultivator,
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
