import type { BuffInstanceState } from '@/engine/buff/types';
import { MaterialGenerator } from '@/engine/material/creation/MaterialGenerator';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { cultivators, materials } from '@/lib/drizzle/schema';
import { QUALITY_VALUES, Quality } from '@/types/constants';
import { and, eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/cultivator/manual/draw
 * 抽取功法/神通典籍
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { cultivator, db }) => {
    const url = new URL(request.url);
    const drawType = url.searchParams.get('type'); // 'gongfa' | 'skill'

    // 查找抽取Buff
    const persistentStatuses = (cultivator.persistent_statuses ||
      []) as BuffInstanceState[];

    let targetBuffId: string | undefined;
    if (drawType === 'gongfa') targetBuffId = 'draw_gongfa_talisman';
    else if (drawType === 'skill') targetBuffId = 'draw_skill_talisman';

    const drawBuff = persistentStatuses.find((s) => {
      if (targetBuffId) return s.configId === targetBuffId;
      return ['draw_gongfa_talisman', 'draw_skill_talisman'].includes(
        s.configId,
      );
    });

    if (!drawBuff) {
      return NextResponse.json(
        { error: targetBuffId ? '未激活对应的抽取符' : '未激活抽取符' },
        { status: 400 },
      );
    }

    const expiresAt = drawBuff.metadata?.expiresAt as number | undefined;
    if (expiresAt && Date.now() > expiresAt) {
      // 移除过期Buff
      const updatedStatuses = persistentStatuses.filter(
        (s) => s.instanceId !== drawBuff.instanceId,
      );

      await db()
        .update(cultivators)
        .set({ persistent_statuses: updatedStatuses })
        .where(eq(cultivators.id, cultivator.id!));

      return NextResponse.json({ error: '抽取符已过期' }, { status: 400 });
    }

    // 随机品质（玄品及以上）
    const qualityWeights: Record<string, number> = {
      玄品: 0.6,
      真品: 0.25,
      地品: 0.1,
      天品: 0.04,
      仙品: 0.009,
      神品: 0.001,
    };
    const allowedQualities = QUALITY_VALUES.slice(
      QUALITY_VALUES.indexOf('玄品'),
    );

    const randomRoll = Math.random();
    let accumulated = 0;
    let selectedQuality: Quality = '玄品';
    for (const q of allowedQualities) {
      accumulated += qualityWeights[q] || 0;
      if (randomRoll <= accumulated) {
        selectedQuality = q;
        break;
      }
    }

    // 生成典籍
    const skeletons = [
      { type: 'manual' as const, rank: selectedQuality, quantity: 1 },
    ];
    const generated = await MaterialGenerator.generateFromSkeletons(skeletons);

    if (generated.length === 0) {
      return NextResponse.json(
        { error: '天道感应模糊，典籍生成失败' },
        { status: 500 },
      );
    }

    const manual = generated[0];

    // 添加到背包并移除Buff
    await db().transaction(async (transaction) => {
      const existing = await transaction
        .select()
        .from(materials)
        .where(
          and(
            eq(materials.cultivatorId, cultivator.id!),
            eq(materials.name, manual.name),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        await transaction
          .update(materials)
          .set({ quantity: sql`${materials.quantity} + 1` })
          .where(eq(materials.id, existing[0].id));
      } else {
        await transaction.insert(materials).values({
          cultivatorId: cultivator.id!,
          name: manual.name,
          type: manual.type,
          rank: manual.rank,
          element: manual.element,
          description: manual.description,
          quantity: manual.quantity,
          details: { price: manual.price },
        });
      }

      const updatedStatuses = persistentStatuses.filter(
        (s) => s.instanceId !== drawBuff.instanceId,
      );
      await transaction
        .update(cultivators)
        .set({ persistent_statuses: updatedStatuses })
        .where(eq(cultivators.id, cultivator.id!));
    });

    return NextResponse.json({
      success: true,
      message: `成功抽取【${manual.name}】`,
      manual,
    });
  },
);
