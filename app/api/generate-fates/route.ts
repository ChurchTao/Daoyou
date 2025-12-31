import { withAuth } from '@/lib/api/withAuth';
import {
  checkAndIncrementReroll,
  saveTempFates,
} from '@/lib/repositories/redisCultivatorRepository';
import { shuffle } from '@/lib/utils';
import { generatePreHeavenFates } from '@/utils/fateGenerator';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const MAX_REROLLS = 3;

const GenerateFatesSchema = z.object({
  tempId: z.string(),
});

/**
 * POST /api/generate-fates
 * 生成先天气运
 */
export const POST = withAuth(async (request: NextRequest) => {
  const body = await request.json();
  const { tempId } = GenerateFatesSchema.parse(body);

  // 检查重随次数
  const { allowed, remaining } = await checkAndIncrementReroll(
    tempId,
    MAX_REROLLS,
  );

  if (!allowed) {
    return NextResponse.json({ error: '气运重随次数已用尽' }, { status: 400 });
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
});
