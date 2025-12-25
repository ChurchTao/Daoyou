import {
  attemptBreakthrough,
  performCultivation,
} from '@/engine/cultivation/CultivationEngine';
import {
  addBreakthroughHistoryEntry,
  addRetreatRecord,
  getCultivatorById,
  getCultivatorRetreatRecords,
  updateCultivator,
} from '@/lib/repositories/cultivatorRepository';
import { createClient } from '@/lib/supabase/server';
import {
  createBreakthroughStory,
  createLifespanExhaustedStory,
} from '@/utils/storyService';
import { NextRequest, NextResponse } from 'next/server';

const COOLDOWN_MINUTES = 5;

export async function POST(request: NextRequest) {
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
    const cultivatorId = body?.cultivatorId as string | undefined;
    const years = Number(body?.years);
    const action =
      (body?.action as 'cultivate' | 'breakthrough') || 'cultivate';

    if (!cultivatorId) {
      return NextResponse.json({ error: '缺少角色ID' }, { status: 400 });
    }

    if (!Number.isFinite(years) || years < 1 || years > 300) {
      return NextResponse.json(
        { error: '闭关年限需在 1~300 年之间' },
        { status: 400 },
      );
    }

    // 检查寿命是否足够
    const cultivator = await getCultivatorById(user.id, cultivatorId);
    if (!cultivator) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }

    if (cultivator.lifespan - cultivator.age <= years) {
      return NextResponse.json(
        { error: '道友，您没有这么多寿元了' },
        { status: 400 },
      );
    }

    // 检查闭关冷却时间（30分钟）
    const retreat_records = await getCultivatorRetreatRecords(
      user.id,
      cultivatorId,
    );
    if (retreat_records && retreat_records.length > 0) {
      const lastRetreat = retreat_records[retreat_records.length - 1];
      const lastRetreatTime = new Date(lastRetreat.timestamp).getTime();
      const now = Date.now();
      const cooldownTime = COOLDOWN_MINUTES * 60 * 1000;

      if (now - lastRetreatTime < cooldownTime) {
        const remainingTime = cooldownTime - (now - lastRetreatTime);
        const remainingMinutes = Math.ceil(remainingTime / (60 * 1000));

        return NextResponse.json(
          {
            error: `道友切莫心急，闭关需循序渐进，请等待 ${remainingMinutes} 分钟`,
          },
          { status: 400 },
        );
      }
    }

    // 根据action执行不同操作
    if (action === 'cultivate') {
      // 修炼模式：积累修为
      const result = performCultivation(cultivator, years);

      // 保存闭关记录
      await addRetreatRecord(user.id, cultivatorId, result.record);

      // 更新角色数据
      const saved = await updateCultivator(user.id, cultivatorId, {
        age: result.cultivator.age,
        closed_door_years_total: result.cultivator.closed_door_years_total,
        cultivation_progress: result.cultivator.cultivation_progress,
      });

      if (!saved) {
        throw new Error('更新角色数据失败');
      }

      return NextResponse.json({
        success: true,
        data: {
          cultivator: saved,
          summary: result.summary,
          action: 'cultivate',
        },
      });
    } else if (action === 'breakthrough') {
      // 突破模式
      const result = attemptBreakthrough(cultivator, years);
      let story: string | undefined;
      let storyType: 'breakthrough' | 'lifespan' | null = null;

      if (result.summary.success) {
        try {
          story = await createBreakthroughStory({
            cultivator: result.cultivator,
            summary: {
              success: result.summary.success,
              isMajor: result.summary.toRealm !== result.summary.fromRealm,
              yearsSpent: result.summary.yearsSpent,
              chance: result.summary.chance,
              roll: result.summary.roll,
              fromRealm: result.summary.fromRealm,
              fromStage: result.summary.fromStage,
              toRealm: result.summary.toRealm,
              toStage: result.summary.toStage,
              lifespanGained: result.summary.lifespanGained,
              attributeGrowth: result.summary.attributeGrowth,
              lifespanDepleted: result.summary.lifespanDepleted,
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
      } else if (result.summary.lifespanDepleted) {
        try {
          story = await createLifespanExhaustedStory({
            cultivator: result.cultivator,
            summary: {
              success: false,
              isMajor: false,
              yearsSpent: result.summary.yearsSpent,
              chance: result.summary.chance,
              roll: result.summary.roll,
              fromRealm: result.summary.fromRealm,
              fromStage: result.summary.fromStage,
              lifespanGained: 0,
              attributeGrowth: {},
              lifespanDepleted: true,
              modifiers: result.summary.modifiers,
            },
          });
          storyType = 'lifespan';
        } catch (storyError) {
          console.warn('生成坐化故事失败：', storyError);
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
      const saved = await updateCultivator(user.id, cultivatorId, {
        realm: result.cultivator.realm,
        realm_stage: result.cultivator.realm_stage,
        age: result.cultivator.age,
        lifespan: result.cultivator.lifespan,
        attributes: result.cultivator.attributes,
        closed_door_years_total: result.cultivator.closed_door_years_total,
        status: result.summary.lifespanDepleted ? 'dead' : 'active',
        cultivation_progress: result.cultivator.cultivation_progress,
      });

      if (!saved) {
        throw new Error('更新角色数据失败');
      }

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
  }
}
