import { NextRequest, NextResponse } from 'next/server';
import { generateCharacter } from '../../../utils/aiClient';
import { getCharacterGenerationPrompt } from '../../../utils/prompts';

/**
 * POST /api/generate-character
 * 生成角色
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userInput } = body;

    if (!userInput || typeof userInput !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的用户输入' },
        { status: 400 }
      );
    }

    // 生成 prompt
    const prompt = getCharacterGenerationPrompt();

    // 调用 AI 生成角色
    const aiResponse = await generateCharacter(prompt, userInput);

    return NextResponse.json({ 
      success: true,
      data: aiResponse 
    });
  } catch (error) {
    console.error('生成角色 API 错误:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : '生成角色失败，请稍后重试';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

