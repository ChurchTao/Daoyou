import * as creationProductRepository from '@/lib/repositories/creationProductRepository';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { NextRequest, NextResponse } from 'next/server';

const VALID_TYPES = new Set(['skill', 'gongfa', 'artifact']);

/**
 * GET /api/v2/products?type=skill|gongfa|artifact
 * 获取当前角色指定类型的所有 v2 产物列表
 */
export const GET = withActiveCultivator(
  async (request: NextRequest, { cultivator }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');

    if (!type || !VALID_TYPES.has(type)) {
      return NextResponse.json(
        { error: '请指定有效的产物类型 (skill|gongfa|artifact)' },
        { status: 400 },
      );
    }

    const products = await creationProductRepository.findByTypeAndCultivator(
      cultivator.id,
      type as import('@/engine/creation-v2/types').CreationProductType,
    );

    return NextResponse.json({ success: true, data: products });
  },
);
