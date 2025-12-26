import {
  attemptBreakthrough,
  performCultivation,
} from '@/engine/cultivation/CultivationEngine';
import { consumeLifespanAndHandleDepletion } from '@/lib/lifespan/handleLifespan';
import { getLifespanLimiter } from '@/lib/redis/lifespanLimiter';
import {
  addBreakthroughHistoryEntry,
  addRetreatRecord,
  getCultivatorById,
  updateCultivator,
} from '@/lib/repositories/cultivatorRepository';
import { createClient } from '@/lib/supabase/server';
import { createBreakthroughStory } from '@/utils/storyService';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const limiter = getLifespanLimiter();
  let cultivatorId: string | undefined;
  let years: number = 0;
  let lockAcquired = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    cultivatorId = body?.cultivatorId as string | undefined;
    years = Number(body?.years);
    const action =
      (body?.action as 'cultivate' | 'breakthrough') || 'cultivate';

    if (!cultivatorId) {
      return NextResponse.json({ error: '缺少角色ID' }, { status: 400 });
    }

    // 1. 尝试获取闭关锁，防止并发
    lockAcquired = await limiter.acquireRetreatLock(cultivatorId);
    if (!lockAcquired) {
      return NextResponse.json(
        { error: '角色正在闭关中，请稍后再试' },
        { status: 409 },
      );
    }

    const cultivator = await getCultivatorById(user.id, cultivatorId);
    if (!cultivator) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }

    // 根捯action执行不同操作
    if (action === 'cultivate') {
      if (!Number.isFinite(years) || years < 1 || years > 200) {
        return NextResponse.json(
          { error: '闭关年限需在 1~200 年之间' },
          { status: 400 },
        );
      }
      // 1. 检查寿命是否足够
      if (cultivator.lifespan - cultivator.age < years) {
        return NextResponse.json(
          { error: '道友，您没有这么多寿元了' },
          { status: 400 },
        );
      }
      // 2. 检查每日寿元消耗限制
      const lifespanCheck = await limiter.checkAndConsumeLifespan(
        cultivatorId,
        years,
      );
      if (!lifespanCheck.allowed) {
        return NextResponse.json(
          {
            error: lifespanCheck.message,
            remaining: lifespanCheck.remaining,
            consumed: lifespanCheck.consumed,
          },
          { status: 400 },
        );
      }

      // 修炼模式：积累修为
      const result = performCultivation(cultivator, years);

      // 保存闭关记录
      await addRetreatRecord(user.id, cultivatorId, result.record);

      // 更新角色数据
      const saved = await updateCultivator(cultivatorId, {
        age: result.cultivator.age,
        closed_door_years_total: result.cultivator.closed_door_years_total,
        cultivation_progress: result.cultivator.cultivation_progress,
      });

      if (!saved) {
        // 更新失败，回滚寿元消耗
        if (lifespanCheck) {
          await limiter.rollbackLifespan(cultivatorId, years);
        }
        throw new Error('更新角色数据失败');
      }

      // 统一处理寿元耗尽的副作用：若寿元耗尽则自动把角色标记为 dead 并生成坐化故事
      try {
        const lifespanResult = await consumeLifespanAndHandleDepletion(
          cultivatorId,
          years,
        );
        if (lifespanResult.depleted && lifespanResult.story) {
          return NextResponse.json({
            success: true,
            data: {
              cultivator: lifespanResult.updatedCultivator ?? saved,
              summary: result.summary,
              action: 'cultivate',
              story: lifespanResult.story,
              storyType: 'lifespan',
              depleted: lifespanResult.depleted,
              lifespanInfo: {
                remaining: lifespanCheck?.remaining,
                consumed: lifespanCheck?.consumed,
              },
            },
          });
        }
      } catch (e) {
        console.warn('处理寿元耗尽失败：', e);
      }

      return NextResponse.json({
        success: true,
        data: {
          cultivator: saved,
          summary: result.summary,
          action: 'cultivate',
          lifespanInfo: {
            remaining: lifespanCheck?.remaining,
            consumed: lifespanCheck?.consumed,
          },
        },
      });
    } else if (action === 'breakthrough') {
      // 突破模式
      const result = attemptBreakthrough(cultivator);
      let story: string | undefined;
      let storyType: 'breakthrough' | 'lifespan' | null = null;

      if (result.summary.success) {
        try {
          story = await createBreakthroughStory({
            cultivator: result.cultivator,
            summary: {
              success: result.summary.success,
              isMajor: result.summary.toRealm !== result.summary.fromRealm,
              yearsSpent: 1,
              chance: result.summary.chance,
              roll: result.summary.roll,
              fromRealm: result.summary.fromRealm,
              fromStage: result.summary.fromStage,
              toRealm: result.summary.toRealm,
              toStage: result.summary.toStage,
              lifespanGained: result.summary.lifespanGained,
              attributeGrowth: result.summary.attributeGrowth,
              lifespanDepleted: false,
              modifiers: result.summary.modifiers,
            },
          });
          storyType = 'breakthrough';
          if (result.historyEntry && story) {
            result.historyEntry.story = story;
          }
        } catch (storyError) {
          console.warn('生成突破故事失败：', storyError);
        }
      }

      // 保存突破历史
      if (result.summary.success && result.historyEntry) {
        await addBreakthroughHistoryEntry(
          user.id,
          cultivatorId,
          result.historyEntry,
        );
      }

      // 更新角色数据
      const saved = await updateCultivator(cultivatorId, {
        realm: result.cultivator.realm,
        realm_stage: result.cultivator.realm_stage,
        age: result.cultivator.age,
        lifespan: result.cultivator.lifespan,
        attributes: result.cultivator.attributes,
        cultivation_progress: result.cultivator.cultivation_progress,
      });

      return NextResponse.json({
        success: true,
        data: {
          cultivator: saved,
          summary: result.summary,
          story,
          storyType,
          action: 'breakthrough',
        },
      });
    } else {
      return NextResponse.json({ error: '无效的action参数' }, { status: 400 });
    }
  } catch (err) {
    console.error('闭关突破 API 错误:', err);

    // 发生错误时，尝试回滚寿元消耗
    if (cultivatorId && years > 0) {
      try {
        await limiter.rollbackLifespan(cultivatorId, years);
      } catch (rollbackErr) {
        console.error('回滚寿元消耗失败:', rollbackErr);
      }
    }

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === 'development'
            ? err instanceof Error
              ? err.message
              : '闭关失败，请稍后重试'
            : '闭关失败，请稍后重试',
      },
      { status: 500 },
    );
  } finally {
    // 始终释放锁
    if (lockAcquired && cultivatorId) {
      try {
        await limiter.releaseRetreatLock(cultivatorId);
      } catch (unlockErr) {
        console.error('释放闭关锁失败:', unlockErr);
      }
    }
  }
}
