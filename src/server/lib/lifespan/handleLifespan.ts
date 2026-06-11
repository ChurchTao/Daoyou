import {
  getCultivatorBasicsByIdUnsafe,
  getCultivatorOwnerId,
  updateCultivator,
} from '@server/lib/services/cultivatorService';
import { invalidateActiveCultivatorRef } from '@server/lib/hono/middleware';
import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import type { BreakthroughModifiers } from '@server/utils/breakthroughCalculator';
import type { LifespanExhaustedStoryPayload } from '@server/utils/prompts';
import { RealmStage, RealmType } from '@shared/types/constants';
import { Cultivator } from '@shared/types/cultivator';

export interface ConsumeLifespanResult {
  depleted: boolean;
  storyPayload?: LifespanExhaustedStoryPayload;
  afterCommit?: () => Promise<void>;
}

/**
 * 消耗寿元并集中处理寿元耗尽的副作用：
 * - 若寿元耗尽（age + years >= lifespan），则设置角色 status 为 'dead'
 * - 返回是否耗尽，以及用于后续流式生成故事的上下文
 */
export async function consumeLifespanAndHandleDepletion(
  cultivatorId: string,
  years: number,
  options: {
    executor?: DbExecutor | DbTransaction;
    deferSideEffects?: boolean;
  } = {},
): Promise<ConsumeLifespanResult> {
  if (years <= 0) {
    return { depleted: false };
  }

  const q = options.executor;
  const cultivator = await getCultivatorBasicsByIdUnsafe(cultivatorId, q);
  if (!cultivator) {
    return { depleted: false };
  }

  const newAge = (cultivator.age || 0) + years;

  // 只在寿元耗尽时做自动更新与故事上下文准备；否则不在此处重复写入年龄（调用方已负责写入）
  if (newAge >= (cultivator.lifespan || 0)) {
    // 更新角色为已死，确保 age 被同步为新的年龄
    let updatedCultivator = null;
    let afterCommit: (() => Promise<void>) | undefined;
    try {
      const ownerId = await getCultivatorOwnerId(cultivatorId, q);
      updatedCultivator = await updateCultivator(cultivatorId, {
        age: newAge,
        status: 'dead',
      }, q);
      if (ownerId) {
        if (options.deferSideEffects) {
          afterCommit = () => invalidateActiveCultivatorRef(ownerId);
        } else {
          await invalidateActiveCultivatorRef(ownerId);
        }
      }
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
        // todo 修复
        cultivator: storyCultivator as Cultivator,
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
      afterCommit,
    };
  }

  return { depleted: false };
}
