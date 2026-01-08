import { withAuth } from '@/lib/api/withAuth';
import { saveTempCharacter } from '@/lib/repositories/redisCultivatorRepository';
import { generateCultivatorFromAI } from '@/utils/characterEngine';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const GenerateCharacterSchema = z.object({
  userInput: z.string().min(2).max(200),
});

/**
 * POST /api/generate-character
 * 生成角色
 */
export const POST = withAuth(async (request: NextRequest) => {
  const body = await request.json();
  const { userInput } = GenerateCharacterSchema.parse(body);

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
