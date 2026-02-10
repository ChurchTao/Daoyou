import type { BuffInstanceState } from '@/engine/buff/types';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { cultivators } from '@/lib/drizzle/schema';
import { redis } from '@/lib/redis';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/cultivator/fate/reshape/abandon
 * 放弃当前重塑（清除缓存和Buff）
 */
export const POST = withActiveCultivator(
  async (_request: NextRequest, { cultivator, db: tx }) => {
    // 查找重塑命格Buff
    const persistentStatuses = (cultivator.persistent_statuses ||
      []) as BuffInstanceState[];
    const reshapeBuff = persistentStatuses.find(
      (s) => s.configId === 'reshape_fate_talisman',
    );

    if (!reshapeBuff) {
      return NextResponse.json(
        { error: '未激活重塑先天命格符' },
        { status: 400 },
      );
    }

    // 清除Redis缓存的命格
    await redis.del(`fate_reshape_pending:${cultivator.id}`);

    // 移除Buff
    const updatedStatuses = persistentStatuses.filter(
      (s) => s.instanceId !== reshapeBuff.instanceId,
    );

    await tx
      .update(cultivators)
      .set({ persistent_statuses: updatedStatuses })
      .where(eq(cultivators.id, cultivator.id!));

    return NextResponse.json({
      success: true,
      message: '已放弃逆天改命，符箓之力消散于天地间。',
    });
  },
);
