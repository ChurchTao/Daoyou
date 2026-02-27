import { withAuth } from '@/lib/api/withAuth';
import { saveTempCharacter } from '@/lib/repositories/redisCultivatorRepository';
import { generateCultivatorFromAI } from '@/utils/characterEngine';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const MIN_PROMPT_LENGTH = 2;
const MAX_PROMPT_LENGTH = 200;

const countChars = (input: string): number => Array.from(input).length;

const GenerateCharacterSchema = z.object({
  userInput: z.string(),
});

/**
 * POST /api/generate-character
 * 生成角色
 */
export const POST = withAuth(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = GenerateCharacterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: '请求参数格式错误，请重新输入角色描述。',
      },
      { status: 400 },
    );
  }

  const userInput = parsed.data.userInput.trim();
  const promptLength = countChars(userInput);

  if (promptLength < MIN_PROMPT_LENGTH) {
    return NextResponse.json(
      {
        success: false,
        error: `角色描述至少需要 ${MIN_PROMPT_LENGTH} 个字。`,
      },
      { status: 400 },
    );
  }

  if (promptLength > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      {
        success: false,
        error: `角色描述过长（当前 ${promptLength} 字，最多 ${MAX_PROMPT_LENGTH} 字）。`,
        code: 'PROMPT_TOO_LONG',
        details: {
          currentLength: promptLength,
          maxLength: MAX_PROMPT_LENGTH,
        },
      },
      { status: 422 },
    );
  }

  // 调用 characterEngine 生成角色
  const { cultivator: rawCultivator } =
    await generateCultivatorFromAI(userInput);

  const cultivator = rawCultivator;

  // 保存到Redis临时存储
  const tempCultivatorId = await saveTempCharacter(cultivator);

  return NextResponse.json({
    success: true,
    data: {
      cultivator,
      tempCultivatorId,
    },
  });
});
