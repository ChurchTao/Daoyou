import { withAuth } from '@/lib/api/withAuth';
import {
  createCultivator,
  getCultivatorsByUserId,
} from '@/lib/repositories/cultivatorRepository';
import {
  deleteTempData,
  getTempCharacter,
  getTempFates,
} from '@/lib/repositories/redisCultivatorRepository';
import { MailService } from '@/lib/services/MailService';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const SaveCharacterSchema = z.object({
  tempCultivatorId: z.string(),
  selectedFateIndices: z.array(z.number()).length(3),
});

/**
 * POST /api/save-character
 * 将临时角色保存到正式表
 */
export const POST = withAuth(async (request: NextRequest, { user }) => {
  const body = await request.json();
  const { tempCultivatorId, selectedFateIndices } =
    SaveCharacterSchema.parse(body);

  // 检查用户是否已有角色
  const existingCultivators = await getCultivatorsByUserId(user.id);
  if (existingCultivators.length > 0) {
    return NextResponse.json(
      { error: '您已经拥有一位道身，无法创建新的道身' },
      { status: 400 },
    );
  }

  // 从Redis获取临时数据
  const [cultivator, availableFates] = await Promise.all([
    getTempCharacter(tempCultivatorId),
    getTempFates(tempCultivatorId),
  ]);

  if (!cultivator) {
    return NextResponse.json(
      { error: '角色数据已过期，请重新生成' },
      { status: 400 },
    );
  }

  // 处理气运
  if (!availableFates) {
    return NextResponse.json(
      { error: '气运数据丢失，请重新生成' },
      { status: 400 },
    );
  }

  const selectedFates = selectedFateIndices
    .filter((idx: number) => idx >= 0 && idx < availableFates.length)
    .map((idx: number) => availableFates[idx]);

  if (selectedFates.length !== 3) {
    return NextResponse.json({ error: '气运选择有误' }, { status: 400 });
  }

  cultivator.pre_heaven_fates = selectedFates;

  // 保存到正式表
  const newCultivator = await createCultivator(user.id, cultivator);

  // 发送新手礼包
  await MailService.sendMail(
    newCultivator.id!,
    '仙缘初结·新手礼包',
    '恭喜道友踏入仙途！大道争锋，财侣法地缺一不可。这有些许灵石，聊表心意，助道友仙路顺遂。',
    [{ type: 'spirit_stones', name: '灵石', quantity: 20000 }],
    'reward',
  );

  // 清理Redis临时数据
  await deleteTempData(tempCultivatorId);

  return NextResponse.json({
    success: true,
  });
});
