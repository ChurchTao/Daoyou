import { withActiveCultivator } from '@/lib/api/withAuth';
import { getExecutor } from '@/lib/drizzle/db';
import { cultivationTechniques, skills } from '@/lib/drizzle/schema';
import { redis } from '@/lib/redis';
import {
  calculateSingleSkillScore,
  calculateSingleTechniqueScore,
} from '@/utils/rankingUtils';
import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/craft/confirm
 * 确认替换或放弃新生成的功法/神通
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { cultivator }) => {
    try {
      const { craftType, replaceId, abandon } = await request.json();

      if (!['create_skill', 'create_gongfa'].includes(craftType)) {
        return NextResponse.json({ error: '无效的造物类型' }, { status: 400 });
      }

      const pendingKey = `creation_pending:${cultivator.id}:${craftType}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pendingItem = await redis.get<any>(pendingKey);

      if (!pendingItem) {
        return NextResponse.json(
          { error: '未找到待确认的造物结果，可能已过期' },
          { status: 404 },
        );
      }

      if (abandon) {
        await redis.del(pendingKey);
        return NextResponse.json({
          success: true,
          message: '已放弃新生成的感悟',
        });
      }

      // 执行替换持久化
      await getExecutor().transaction(async (tx) => {
        if (craftType === 'create_skill') {
          if (replaceId) {
            // 删除旧技能
            await tx
              .delete(skills)
              .where(
                and(
                  eq(skills.id, replaceId),
                  eq(skills.cultivatorId, cultivator.id!),
                ),
              );
          }
          // 插入新技能
          const score = calculateSingleSkillScore(pendingItem);
          // 移除不需要存入数据库的临时字段
          const {
            needs_replace: _n,
            currentCount: _c,
            maxCount: _m,
            ...skillData
          } = pendingItem as Record<string, unknown>;

          await tx.insert(skills).values({
            cultivatorId: cultivator.id!,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(skillData as any),
            target_self: skillData.target_self ? 1 : 0,
            score,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            effects: (skillData.effects as any) || [],
          });
        } else if (craftType === 'create_gongfa') {
          if (replaceId) {
            // 删除旧功法
            await tx
              .delete(cultivationTechniques)
              .where(
                and(
                  eq(cultivationTechniques.id, replaceId),
                  eq(cultivationTechniques.cultivatorId, cultivator.id!),
                ),
              );
          }
          // 插入新功法
          const score = calculateSingleTechniqueScore(pendingItem);
          const {
            needs_replace: _n,
            currentCount: _c,
            maxCount: _m,
            ...techniqueData
          } = pendingItem as Record<string, unknown>;

          await tx.insert(cultivationTechniques).values({
            cultivatorId: cultivator.id!,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(techniqueData as any),
            score,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            effects: (techniqueData.effects as any) || [],
          });
        }
      });

      await redis.del(pendingKey);
      return NextResponse.json({
        success: true,
        message: '领悟成功，已纳入道基',
      });
    } catch (e) {
      console.error('确认替换失败:', e);
      return NextResponse.json(
        { error: '确认失败，请稍后重试' },
        { status: 500 },
      );
    }
  },
);
