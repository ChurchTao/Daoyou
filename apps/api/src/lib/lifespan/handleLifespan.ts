import { cultivators } from '@server/lib/drizzle/schema.js';
import type { DbTransaction } from '@server/lib/drizzle/db.js';
import { invalidateActiveCultivatorRef } from '@server/lib/auth/activeCultivator.js';
import { findActiveCultivatorOwnerId } from '@server/lib/repositories/cultivatorRepository.js';
import { updateCultivator } from '@server/cultivator/application/readers/CultivatorStateRepository.js';
import type { BreakthroughModifiers } from '@daoyou/game-domain/cultivation';
import type {
  LifespanExhaustedStoryPayload,
  RetreatStoryCultivator,
} from '@server/utils/prompts.js';
import { RealmStage, RealmType } from '@daoyou/constants/realms';
import { eq } from 'drizzle-orm';

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
    tx: DbTransaction;
    /** 调用方已完成年龄结算时传入，避免在死亡判定中重复累加 years。 */
    ageAfterConsumption?: number;
    storyCultivator: RetreatStoryCultivator;
  },
): Promise<ConsumeLifespanResult> {
  if (years <= 0) {
    return { depleted: false };
  }

  const [cultivator] = await options.tx
    .select({
      age: cultivators.age,
      lifespan: cultivators.lifespan,
      realm: cultivators.realm,
      realmStage: cultivators.realm_stage,
    })
    .from(cultivators)
    .where(eq(cultivators.id, cultivatorId))
    .limit(1);
  if (!cultivator) {
    return { depleted: false };
  }

  const newAge = options.ageAfterConsumption ?? (cultivator.age || 0) + years;

  // 只在寿元耗尽时做自动更新与故事上下文准备；否则不在此处重复写入年龄（调用方已负责写入）
  if (newAge >= (cultivator.lifespan || 0)) {
    // 更新角色为已死，确保 age 被同步为新的年龄
    let afterCommit: (() => Promise<void>) | undefined;
    try {
      const ownerId = await findActiveCultivatorOwnerId(
        cultivatorId,
        options.tx,
      );
      await updateCultivator(
        cultivatorId,
        {
          age: newAge,
          status: 'dead',
        },
        options.tx,
      );
      if (ownerId) {
        afterCommit = () => invalidateActiveCultivatorRef(ownerId);
      }
    } catch (err) {
      console.error('更新角色为死时失败：', err);
    }

    const storyCultivator = {
      ...options.storyCultivator,
      age: newAge,
      status: 'dead' as const,
    };

    return {
      depleted: true,
      storyPayload: {
        // todo 修复
        cultivator: storyCultivator,
        summary: {
          success: false,
          isMajor: false,
          yearsSpent: years,
          chance: 0,
          roll: 0,
          fromRealm: cultivator.realm as RealmType,
          fromStage: cultivator.realmStage as RealmStage,
          lifespanGained: 0,
          attributeGrowth: {},
          attributePointReward: 0,
          lifespanDepleted: true,
          modifiers: {} as BreakthroughModifiers,
        },
      },
      afterCommit,
    };
  }

  return { depleted: false };
}
