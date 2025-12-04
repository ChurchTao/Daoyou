import {
  addBreakthroughHistoryEntry,
  addRetreatRecord,
  getCultivatorById,
  updateCultivator,
} from '@/lib/repositories/cultivatorRepository';
import { createClient } from '@/lib/supabase/server';
import { performRetreatBreakthrough } from '@/utils/breakthroughEngine';
import {
  createBreakthroughStory,
  createLifespanExhaustedStory,
} from '@/utils/storyService';
import { NextRequest, NextResponse } from 'next/server';

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

    if (!cultivatorId) {
      return NextResponse.json({ error: '缺少角色ID' }, { status: 400 });
    }

    if (!Number.isFinite(years) || years < 1 || years > 500) {
      return NextResponse.json(
        { error: '闭关年限需在 1~500 年之间' },
        { status: 400 },
      );
    }

    const cultivator = await getCultivatorById(user.id, cultivatorId);
    if (!cultivator) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }

    const result = performRetreatBreakthrough(cultivator, { years });
    let story: string | undefined;
    let storyType: 'breakthrough' | 'lifespan' | null = null;

    if (result.summary.success) {
      try {
        story = await createBreakthroughStory({
          cultivator: result.cultivator,
          summary: result.summary,
        });
        storyType = 'breakthrough';
        if (
          story &&
          result.cultivator.breakthrough_history &&
          result.cultivator.breakthrough_history.length > 0
        ) {
          result.cultivator.breakthrough_history[
            result.cultivator.breakthrough_history.length - 1
          ].story = story;
        }
      } catch (storyError) {
        console.warn('生成突破故事失败：', storyError);
      }
    } else if (result.summary.lifespanDepleted) {
      try {
        story = await createLifespanExhaustedStory({
          cultivator: result.cultivator,
          summary: result.summary,
        });
        storyType = 'lifespan';
      } catch (storyError) {
        console.warn('生成坐化故事失败：', storyError);
      }
    }

    const retreatRecords = result.cultivator.retreat_records ?? [];
    const latestRetreatRecord =
      retreatRecords.length > 0
        ? retreatRecords[retreatRecords.length - 1]
        : undefined;
    if (latestRetreatRecord) {
      await addRetreatRecord(user.id, cultivatorId, latestRetreatRecord);
    }

    if (result.summary.success) {
      const breakthroughHistory = result.cultivator.breakthrough_history ?? [];
      const latestBreakthrough =
        breakthroughHistory.length > 0
          ? breakthroughHistory[breakthroughHistory.length - 1]
          : undefined;
      if (latestBreakthrough) {
        await addBreakthroughHistoryEntry(
          user.id,
          cultivatorId,
          latestBreakthrough,
        );
      }
    }

    const saved = await updateCultivator(user.id, cultivatorId, {
      realm: result.cultivator.realm,
      realm_stage: result.cultivator.realm_stage,
      age: result.cultivator.age,
      lifespan: result.cultivator.lifespan,
      attributes: result.cultivator.attributes,
      closed_door_years_total: result.cultivator.closed_door_years_total,
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
      },
    });
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
