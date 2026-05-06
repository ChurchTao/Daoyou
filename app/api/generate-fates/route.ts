import { withAuth } from '@/lib/api/withAuth';
import { FATE_REROLL_LIMIT } from '@/lib/services/FateConfig';
import { FateEngine } from '@/lib/services/FateEngine';
import {
  checkAndIncrementReroll,
  getTempCharacter,
  getTempFates,
  saveTempFates,
} from '@/lib/repositories/redisCultivatorRepository';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const GenerateFatesSchema = z.object({
  tempId: z.string().min(1),
});

export const POST = withAuth(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = GenerateFatesSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: '请求参数格式错误' },
      { status: 400 },
    );
  }

  const { tempId } = parsed.data;
  const cultivator = await getTempCharacter(tempId);
  if (!cultivator) {
    return NextResponse.json(
      { success: false, error: '角色推演已过期，请重新生成。' },
      { status: 404 },
    );
  }

  const previousFates = await getTempFates(tempId);
  let remainingRerolls = FATE_REROLL_LIMIT;

  if (previousFates && previousFates.length > 0) {
    const rerollCheck = await checkAndIncrementReroll(tempId, FATE_REROLL_LIMIT);
    if (!rerollCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `逆天改命次数已尽（最多 ${FATE_REROLL_LIMIT} 次）`,
        },
        { status: 400 },
      );
    }
    remainingRerolls = rerollCheck.remaining;
  }

  const fates = await FateEngine.generateCandidatePool(cultivator, {
    strategy: 'root_restricted',
  });
  await saveTempFates(tempId, fates);

  return NextResponse.json({
    success: true,
    data: {
      fates,
      remainingRerolls,
    },
  });
});
