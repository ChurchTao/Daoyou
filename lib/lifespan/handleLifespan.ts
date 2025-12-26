import {
  getCultivatorBasicsByIdUnsafe,
  updateCultivator,
} from '@/lib/repositories/cultivatorRepository';
import { RealmStage, RealmType } from '@/types/constants';
import type { Cultivator } from '@/types/cultivator';
import type { BreakthroughModifiers } from '@/utils/breakthroughCalculator';
import { createLifespanExhaustedStory } from '@/utils/storyService';

export interface ConsumeLifespanResult {
  depleted: boolean;
  story?: string;
  updatedCultivator?: Cultivator | null;
}

/**
 * 消耗寿元并集中处理寿元耗尽的副作用：
 * - 若寿元耗尽（age + years >= lifespan），则设置角色 status 为 'dead' 并尝试生成坐化故事
 * - 返回是否耗尽、可能的故事和已更新的角色快照
 */
export async function consumeLifespanAndHandleDepletion(
  cultivatorId: string,
  years: number,
): Promise<ConsumeLifespanResult> {
  if (years <= 0) {
    return { depleted: false };
  }

  const cultivator = await getCultivatorBasicsByIdUnsafe(cultivatorId);
  if (!cultivator) {
    return { depleted: false };
  }

  const newAge = (cultivator.age || 0) + years;

  // 只在寿元耗尽时做自动更新与故事生成；否则不在此处重复写入年龄（调用方已负责写入）
  if (newAge >= (cultivator.lifespan || 0)) {
    // 更新角色为已死，确保 age 被同步为新的年龄
    let updatedCultivator = null;
    try {
      updatedCultivator = await updateCultivator(cultivatorId, {
        age: newAge,
        status: 'dead',
      });
    } catch (err) {
      console.error('更新角色为死时失败：', err);
    }

    // 尝试生成坐化故事（失败不影响主流程）
    let story: string | undefined;
    try {
      story = await createLifespanExhaustedStory({
        cultivator: {
          ...updatedCultivator!,
          age: newAge,
          status: 'dead',
        },
        summary: {
          success: false,
          isMajor: false,
          yearsSpent: years,
          chance: 0,
          roll: 0,
          fromRealm: cultivator.realm as RealmType,
          fromStage: cultivator.realm_stage as RealmStage,
          lifespanGained: 0,
          attributeGrowth: {},
          lifespanDepleted: true,
          modifiers: {} as BreakthroughModifiers,
        },
      });
    } catch (storyErr) {
      console.warn('生成坐化故事失败：', storyErr);
    }

    return { depleted: true, story, updatedCultivator };
  }

  return { depleted: false };
}
