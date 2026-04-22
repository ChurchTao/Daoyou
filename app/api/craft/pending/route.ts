import {
  getPendingCreation,
} from '@/lib/services/creationServiceV2';
import { isCreationCraftType } from '@/engine/creation-v2/config/CreationCraftPolicy';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/craft/pending?type=create_skill
 * 获取当前待确定的造物结果（v2 引擎）
 * Redis key: creation_pending_v2:{cultivatorId}:{craftType}
 */
export const GET = withActiveCultivator(
  async (request: NextRequest, { cultivator }) => {
    const url = new URL(request.url);
    const craftType = url.searchParams.get('type');

    if (!craftType || !isCreationCraftType(craftType)) {
      return NextResponse.json({ error: '无效的造物类型' }, { status: 400 });
    }

    const pending = await getPendingCreation(cultivator.id, craftType);

    return NextResponse.json({
      success: true,
      hasPending: !!pending,
      item: pending || null,
    });
  },
);
