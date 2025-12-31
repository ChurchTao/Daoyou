import { withActiveCultivator } from '@/lib/api/withAuth';
import { db } from '@/lib/drizzle/db';
import * as schema from '@/lib/drizzle/schema';
import { equipEquipment } from '@/lib/repositories/cultivatorRepository';
import { eq } from 'drizzle-orm';
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
  // 获取装备状态
  const equippedItems = await db
    .select()
    .from(schema.equippedItems)
    .where(eq(schema.equippedItems.cultivatorId, cultivator.id));

  if (equippedItems.length === 0) {
    // 如果没有装备状态记录，返回空状态
    return NextResponse.json({
      success: true,
      data: { weapon: null, armor: null, accessory: null },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      weapon: equippedItems[0].weapon_id || null,
      armor: equippedItems[0].armor_id || null,
      accessory: equippedItems[0].accessory_id || null,
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
