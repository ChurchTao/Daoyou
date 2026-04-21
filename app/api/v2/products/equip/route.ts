import * as creationProductRepository from '@/lib/repositories/creationProductRepository';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const EquipSchema = z.object({
  productId: z.string().uuid(),
});

/**
 * GET /api/v2/products/equip
 * 获取当前角色已装备的 v2 法宝列表
 */
export const GET = withActiveCultivator(async (_req, { cultivator }) => {
  const equipped = await creationProductRepository.findEquippedArtifacts(
    cultivator.id,
  );
  return NextResponse.json({ success: true, data: equipped });
});

/**
 * POST /api/v2/products/equip
 * 装备/卸下 v2 法宝（toggle 模式）
 *
 * Body: { productId: string }
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { cultivator }) => {
    const body = await request.json();
    const { productId } = EquipSchema.parse(body);

    const product = await creationProductRepository.findById(productId);
    if (!product || product.cultivatorId !== cultivator.id) {
      return NextResponse.json(
        { error: '法宝不存在或不属于你' },
        { status: 404 },
      );
    }

    if (product.productType !== 'artifact') {
      return NextResponse.json(
        { error: '只有法宝才能装备' },
        { status: 400 },
      );
    }

    if (!product.slot) {
      return NextResponse.json(
        { error: '法宝缺少槽位信息' },
        { status: 400 },
      );
    }

    // Toggle: 已装备则卸下，否则装备
    if (product.isEquipped) {
      await creationProductRepository.unequipArtifact(productId);
      return NextResponse.json({ success: true, equipped: false });
    } else {
      await creationProductRepository.equipArtifact(
        productId,
        cultivator.id,
        product.slot,
      );
      return NextResponse.json({ success: true, equipped: true });
    }
  },
);
