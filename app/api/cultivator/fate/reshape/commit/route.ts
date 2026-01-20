import { withActiveCultivator } from '@/lib/api/withAuth';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { cultivators, preHeavenFates } from '@/lib/drizzle/schema';
import type { BuffInstanceState } from '@/engine/buff/types';
import type { EffectConfig } from '@/engine/effect/types';
import { NextRequest, NextResponse } from 'next/server';

const CommitSchema = z.object({
  newFates: z.array(
    z.object({
      name: z.string(),
      quality: z.string(),
      effects: z.array(z.any()), // EffectConfig
      description: z.string(),
    }),
  ),
  replaceIndices: z
    .array(z.number())
    .optional(), // 要替换的旧命格索引，不传表示不替换
});

/**
 * POST /api/cultivator/fate/reshape/commit
 * 提交命格替换
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { cultivator, db: tx }) => {
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

    const body = await request.json();
    const { newFates, replaceIndices } = CommitSchema.parse(body);

    // 如果指定了替换索引
    if (replaceIndices && replaceIndices.length > 0) {
      // 从数据库查询当前命格
      const currentFates = await tx
        .select()
        .from(preHeavenFates)
        .where(eq(preHeavenFates.cultivatorId, cultivator.id!));

      // 删除旧命格（根据索引）
      for (const index of replaceIndices) {
        if (index >= 0 && index < currentFates.length) {
          const oldFate = currentFates[index];
          await tx
            .delete(preHeavenFates)
            .where(eq(preHeavenFates.id, oldFate.id));
        }
      }

      // 添加新命格
      for (const fate of newFates) {
        await tx.insert(preHeavenFates).values({
          cultivatorId: cultivator.id!,
          name: fate.name,
          quality: fate.quality,
          effects: fate.effects as EffectConfig[],
          description: fate.description,
        });
      }
    }

    // 移除Buff（无论是否替换，提交后Buff都会消失）
    const updatedStatuses = persistentStatuses.filter(
      (s) => s.instanceId !== reshapeBuff.instanceId,
    );

    await tx
      .update(cultivators)
      .set({ persistent_statuses: updatedStatuses })
      .where(eq(cultivators.id, cultivator.id!));

    return NextResponse.json({
      success: true,
      message: replaceIndices?.length
        ? `成功重塑 ${replaceIndices.length} 个先天命格`
        : '已放弃重塑',
    });
  },
);
