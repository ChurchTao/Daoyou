import { withActiveCultivator } from '@/lib/api/withAuth';
import * as creationProductRepository from '@/lib/repositories/creationProductRepository';
import { equipEquipment } from '@/lib/services/cultivatorService';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const EquipSchema = z.object({
  artifactId: z.string(),
});

/**
 * GET /api/cultivator/equip
 * 获取当前活跃角色装备状态
 */
export const GET = withActiveCultivator(async (_req, { cultivator }) => {
  const equippedItems = await creationProductRepository.findEquippedArtifacts(
    cultivator.id,
  );

  return NextResponse.json({
    success: true,
    data: {
      weapon: equippedItems.find((item) => item.slot === 'weapon')?.id ?? null,
      armor: equippedItems.find((item) => item.slot === 'armor')?.id ?? null,
      accessory:
        equippedItems.find((item) => item.slot === 'accessory')?.id ?? null,
    },
  });
});

/**
 * POST /api/cultivator/equip
 * 装备/卸下装备
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { user, cultivator }) => {
    const body = await request.json();
    const { artifactId } = EquipSchema.parse(body);

    // 装备或卸下装备
    const equippedItems = await equipEquipment(
      user.id,
      cultivator.id,
      artifactId,
    );

    return NextResponse.json({
      success: true,
      data: equippedItems,
    });
  },
);
