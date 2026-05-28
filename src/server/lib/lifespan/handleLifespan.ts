import {
  getCultivatorBasicsByIdUnsafe,
  updateCultivator,
} from '@server/lib/services/cultivatorService';
import type { BreakthroughModifiers } from '@server/utils/breakthroughCalculator';
import type { LifespanExhaustedStoryPayload } from '@server/utils/prompts';
import { RealmStage, RealmType } from '@shared/types/constants';

export interface ConsumeLifespanResult {
  depleted: boolean;
  storyPayload?: LifespanExhaustedStoryPayload;
}

/**
 * 消耗寿元并集中处理寿元耗尽的副作用：
 * - 若寿元耗尽（age + years >= lifespan），则设置角色 status 为 'dead'
 * - 返回是否耗尽，以及用于后续流式生成故事的上下文
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

  // 只在寿元耗尽时做自动更新与故事上下文准备；否则不在此处重复写入年龄（调用方已负责写入）
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

    const storyCultivator = {
      ...(updatedCultivator ?? cultivator),
      age: newAge,
      status: 'dead' as const,
    };

    return {
      depleted: true,
      storyPayload: {
        cultivator: storyCultivator,
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
      },
    };
  }

  return { depleted: false };
}
