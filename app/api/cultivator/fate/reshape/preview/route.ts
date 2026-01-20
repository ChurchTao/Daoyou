import { withActiveCultivator } from '@/lib/api/withAuth';
import { FateGenerator } from '@/engine/fate/creation/FateGenerator';
import { eq } from 'drizzle-orm';
import { cultivators } from '@/lib/drizzle/schema';
import type { BuffInstanceState } from '@/engine/buff/types';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/cultivator/fate/reshape/preview
 * 预览随机命格（消耗1次机会）
 */
export const GET = withActiveCultivator(
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

    // 检查Buff是否过期
    const expiresAt = reshapeBuff.metadata?.expiresAt as number | undefined;
    if (expiresAt && Date.now() > expiresAt) {
      // 移除过期Buff
      const updatedStatuses = persistentStatuses.filter(
        (s) => s.instanceId !== reshapeBuff.instanceId,
      );

      await tx
        .update(cultivators)
        .set({ persistent_statuses: updatedStatuses })
        .where(eq(cultivators.id, cultivator.id!));

      return NextResponse.json(
        { error: '重塑先天命格符已过期' },
        { status: 400 },
      );
    }

    const usesRemaining = (reshapeBuff.metadata?.usesRemaining as number) ?? 0;
    if (usesRemaining <= 0) {
      return NextResponse.json(
        { error: '重塑次数已用尽，请提交替换或放弃' },
        { status: 400 },
      );
    }

    // 生成3个随机命格
    const fates = await FateGenerator.generate({ count: 3 });

    // 扣除1次机会
    const updatedStatuses = persistentStatuses.map((s) => {
      if (s.instanceId === reshapeBuff.instanceId) {
        return {
          ...s,
          metadata: {
            ...s.metadata,
            usesRemaining: usesRemaining - 1,
          },
        };
      }
      return s;
    });

    await tx
      .update(cultivators)
      .set({ persistent_statuses: updatedStatuses })
      .where(eq(cultivators.id, cultivator.id!));

    return NextResponse.json({
      success: true,
      fates,
      usesRemaining: usesRemaining - 1,
    });
  },
);
