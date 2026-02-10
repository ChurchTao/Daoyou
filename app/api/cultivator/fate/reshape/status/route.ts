import type { BuffInstanceState } from '@/engine/buff/types';
import type { GeneratedFate } from '@/engine/fate/creation/types';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { redis } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/cultivator/fate/reshape/status
 * 获取当前重塑状态（是否有缓存的命格、剩余次数）
 */
export const GET = withActiveCultivator(
  async (_request: NextRequest, { cultivator }) => {
    // 查找重塑命格Buff
    const persistentStatuses = (cultivator.persistent_statuses ||
      []) as BuffInstanceState[];
    const reshapeBuff = persistentStatuses.find(
      (s) => s.configId === 'reshape_fate_talisman',
    );

    // 没有激活的Buff，返回空状态
    if (!reshapeBuff) {
      return NextResponse.json({
        hasBuff: false,
        hasPendingFates: false,
        usesRemaining: 0,
        fates: null,
      });
    }

    // 检查Buff是否过期
    const expiresAt = reshapeBuff.metadata?.expiresAt as number | undefined;
    if (expiresAt && Date.now() > expiresAt) {
      return NextResponse.json({
        hasBuff: false,
        hasPendingFates: false,
        usesRemaining: 0,
        fates: null,
        buffExpired: true,
      });
    }

    const usesRemaining = (reshapeBuff.metadata?.usesRemaining as number) ?? 0;

    // 检查是否有缓存的命格
    const cachedFates = await redis.get<GeneratedFate[]>(
      `fate_reshape_pending:${cultivator.id}`,
    );

    return NextResponse.json({
      hasBuff: true,
      hasPendingFates: !!cachedFates,
      usesRemaining,
      fates: cachedFates ?? null,
    });
  },
);
