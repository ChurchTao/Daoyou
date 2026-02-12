import type { BuffInstanceState } from '@/engine/buff/types';
import type { EffectConfig } from '@/engine/effect/types';
import type { GeneratedFate } from '@/engine/fate/creation/types';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { getExecutor } from '@/lib/drizzle/db';
import { cultivators, preHeavenFates } from '@/lib/drizzle/schema';
import { redis } from '@/lib/redis';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const CommitSchema = z.object({
  selectedIndices: z.array(z.number()), // 用户选择的预览命格索引
  replaceIndices: z.array(z.number()).optional(), // 要替换的旧命格索引，不传表示不替换
});

/**
 * POST /api/cultivator/fate/reshape/commit
 * 提交命格替换
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { cultivator }) => {
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
    const { selectedIndices, replaceIndices } = CommitSchema.parse(body);

    // 校验：无修改不允许提交
    if (
      (!replaceIndices || replaceIndices.length === 0) &&
      selectedIndices.length === 0
    ) {
      return NextResponse.json(
        { error: '未作任何更改，无法逆转乾坤' },
        { status: 400 },
      );
    }

    // 校验：一次最多舍弃3个旧命数
    if (replaceIndices && replaceIndices.length > 3) {
      return NextResponse.json(
        { error: `一次最多舍弃3个命数，当前已选${replaceIndices.length}个` },
        { status: 400 },
      );
    }

    // 从Redis获取暂存的命格
    const cachedFates = await redis.get<GeneratedFate[]>(
      `fate_reshape_pending:${cultivator.id}`,
    );

    if (!cachedFates) {
      return NextResponse.json(
        { error: '预览已过期或未进行预览，请重新预览' },
        { status: 400 },
      );
    }

    // 验证并获取选中的新命格
    const newFates = selectedIndices
      .map((idx) => cachedFates[idx])
      .filter(Boolean);

    if (newFates.length !== selectedIndices.length) {
      return NextResponse.json(
        { error: '选择的命格索引无效' },
        { status: 400 },
      );
    }

    // 从数据库查询当前命格
    const currentFates = await getExecutor()
      .select()
      .from(preHeavenFates)
      .where(eq(preHeavenFates.cultivatorId, cultivator.id!));

    // 删除旧命格（如果指定了替换索引）
    if (replaceIndices && replaceIndices.length > 0) {
      // 删除旧命格（根据索引）
      for (const index of replaceIndices) {
        if (index >= 0 && index < currentFates.length) {
          const oldFate = currentFates[index];
          await getExecutor()
            .delete(preHeavenFates)
            .where(eq(preHeavenFates.id, oldFate.id));
        }
      }
    }

    // 检查命格总数不能超过3个
    const deleteCount = replaceIndices?.length ?? 0;
    const finalFateCount = currentFates.length - deleteCount + newFates.length;
    if (finalFateCount > 3) {
      return NextResponse.json(
        {
          error: `先天命格总数不能超过3个。当前${currentFates.length}个，删除${deleteCount}个，新增${newFates.length}个，最终${finalFateCount}个`,
        },
        { status: 400 },
      );
    }

    // 添加新命格（独立于删除操作）
    for (const fate of newFates) {
      await getExecutor()
        .insert(preHeavenFates)
        .values({
          cultivatorId: cultivator.id!,
          name: fate.name,
          quality: fate.quality,
          effects: fate.effects as EffectConfig[],
          description: fate.description,
        });
    }

    // 移除Redis缓存
    await redis.del(`fate_reshape_pending:${cultivator.id}`);

    // 移除Buff（无论是否替换，提交后Buff都会消失）
    const updatedStatuses = persistentStatuses.filter(
      (s) => s.instanceId !== reshapeBuff.instanceId,
    );

    await getExecutor()
      .update(cultivators)
      .set({ persistent_statuses: updatedStatuses })
      .where(eq(cultivators.id, cultivator.id!));

    const addCount = newFates.length;

    return NextResponse.json({
      success: true,
      message:
        deleteCount > 0
          ? `成功重塑 ${deleteCount} 个先天命格（新增 ${addCount} 个）`
          : addCount > 0
            ? `成功获得 ${addCount} 个新命格`
            : '已放弃重塑',
    });
  },
);
