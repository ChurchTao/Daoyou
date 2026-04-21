import * as creationProductRepository from '@/lib/repositories/creationProductRepository';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v2/products/[id]
 * 获取单个 v2 产物详情（含完整 product_model，供前端渲染词缀等）
 */
export const GET = withActiveCultivator(
  async (_request: NextRequest, { cultivator }, params) => {
    const { id } = params as { id: string };

    const product = await creationProductRepository.findById(id);
    if (!product || product.cultivatorId !== cultivator.id) {
      return NextResponse.json({ error: '产物不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: product });
  },
);

/**
 * DELETE /api/v2/products/[id]
 * 遗忘/丢弃一个 v2 产物（神通/功法/法宝）
 */
export const DELETE = withActiveCultivator(
  async (_request: NextRequest, { cultivator }, params) => {
    const { id } = params as { id: string };

    const product = await creationProductRepository.findById(id);
    if (!product || product.cultivatorId !== cultivator.id) {
      return NextResponse.json({ error: '产物不存在或不属于你' }, { status: 404 });
    }

    await creationProductRepository.deleteById(id);

    return NextResponse.json({ success: true });
  },
);
