import { DbTransaction, db } from '@/lib/drizzle/db';
import { cultivators, materials } from '@/lib/drizzle/schema';
import { redis } from '@/lib/redis';
import { getCultivatorById } from '@/lib/repositories/cultivatorRepository';
import { Quality } from '@/types/constants';
import { Material } from '@/types/cultivator';
import { object } from '@/utils/aiClient';
import { sanitizePrompt } from '@/utils/prompts';
import { eq, inArray, sql } from 'drizzle-orm';
import { calculateMaxQuality, getCostDescription } from './CraftCostCalculator';
import { CreationStrategy } from './CreationStrategy';
import { AlchemyStrategy } from './strategies/AlchemyStrategy';
import { GongFaCreationStrategy } from './strategies/GongFaCreationStrategy';
import { RefiningStrategy } from './strategies/RefiningStrategy';
import { SkillCreationStrategy } from './strategies/SkillCreationStrategy';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupportedStrategies = CreationStrategy<any, any>;

export class CreationEngineError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'CreationEngineError';
  }
}

export class CreationEngine {
  private strategies: Map<string, SupportedStrategies> = new Map();

  constructor() {
    this.registerStrategy(new RefiningStrategy());
    this.registerStrategy(new AlchemyStrategy());
    this.registerStrategy(new SkillCreationStrategy());
    this.registerStrategy(new GongFaCreationStrategy());
  }

  private registerStrategy(strategy: SupportedStrategies) {
    this.strategies.set(strategy.craftType, strategy);
  }

  /**
   * 处理造物请求（端到端）
   *
   * 新流程：
   * 1. 加载数据 & 校验
   * 2. 调用 AI 获取蓝图
   * 3. 调用 strategy.materialize() 将蓝图转化为实际物品
   * 4. 事务内消耗材料 + 持久化结果
   */
  async processRequest(
    userId: string,
    cultivatorId: string,
    materialIds: string[],
    prompt: string,
    craftType: string,
  ): Promise<unknown> {
    // 1. Acquire Lock
    const lockKey = `craft:lock:${cultivatorId}`;
    const acquiredLock = await redis.set(lockKey, 'locked', {
      nx: true,
      ex: 30,
    });

    if (!acquiredLock) {
      throw new CreationEngineError('炉火正旺，道友莫急', 429);
    }

    try {
      // 2. Load Data & Validate Ownership
      // 2.1 Materials
      const selectedMaterials = await db()
        .select()
        .from(materials)
        .where(inArray(materials.id, materialIds));

      if (selectedMaterials.length !== materialIds.length) {
        throw new CreationEngineError('部分材料已耗尽或不存在');
      }

      for (const mat of selectedMaterials) {
        if (mat.cultivatorId !== cultivatorId) {
          throw new CreationEngineError('非本人材料，不可动用', 403);
        }
      }

      // 2.2 Cultivator
      const cultivator = await getCultivatorById(userId, cultivatorId);

      if (!cultivator) {
        throw new CreationEngineError('道友查无此人', 404);
      }

      // 3. Select Strategy
      const strategy = this.strategies.get(craftType);
      if (!strategy) {
        throw new CreationEngineError(`未知的造物类型: ${craftType}`);
      }

      // 4. Strategy Validation
      const context = {
        cultivator: cultivator,
        materials: selectedMaterials as unknown as Material[],
        userPrompt: sanitizePrompt(prompt),
      };
      try {
        await strategy.validate(context);
      } catch (error) {
        if (error instanceof CreationEngineError) {
          throw error;
        }
        if (error instanceof Error) {
          throw new CreationEngineError(error.message);
        }
        throw error;
      }

      // 4.5. Resource Cost Calculation & Validation
      const maxMaterialQuality = calculateMaxQuality(
        selectedMaterials as unknown as Array<{ rank: Quality }>,
      );
      const costDescription = getCostDescription(maxMaterialQuality, craftType);

      // 5. Construct Prompt & Call AI (获取蓝图)
      const { system, user } = strategy.constructPrompt(context);

      const aiResponse = await object(system, user, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        schema: strategy.schema as any,
        schemaName: strategy.schemaName,
        schemaDescription: strategy.schemaDescription,
      });

      const blueprint = aiResponse.object;

      // 6. Materialize: 将蓝图转化为实际物品（数值由配置表控制）
      const resultItem = strategy.materialize(blueprint, context);

      // 7. Transaction: Consumption & Persistence
      await db().transaction(async (tx) => {
        // 7.1 Consume Resources (灵石/感悟)
        await this.consumeResources(tx, cultivator, costDescription);

        // 7.2 Consume Materials
        for (const mat of selectedMaterials) {
          if (mat.quantity > 1) {
            await tx
              .update(materials)
              .set({ quantity: sql`${materials.quantity} - 1` })
              .where(eq(materials.id, mat.id));
          } else {
            await tx.delete(materials).where(eq(materials.id, mat.id));
          }
        }

        // 7.3 Persist Result (Delegated to Strategy)
        await strategy.persistResult(
          tx as unknown as DbTransaction,
          context,
          resultItem,
        );
      });

      return resultItem;
    } finally {
      await redis.del(lockKey);
    }
  }

  /**
   * 消耗资源（在事务中）
   * @param tx 数据库事务
   * @param cultivator 角色
   * @param cost 资源消耗描述
   */
  private async consumeResources(
    tx: DbTransaction,
    cultivator: {
      id?: string;
      spirit_stones?: number;
      cultivation_progress?: { comprehension_insight?: number } | null;
    },
    cost: { spiritStones?: number; comprehension?: number },
  ): Promise<void> {
    // 检查灵石
    if (
      cost.spiritStones &&
      (cultivator.spirit_stones || 0) < cost.spiritStones
    ) {
      throw new CreationEngineError(`灵石不足，需要 ${cost.spiritStones} 枚`);
    }

    // 检查感悟
    if (cost.comprehension) {
      const currentInsight =
        cultivator.cultivation_progress?.comprehension_insight || 0;
      if (currentInsight < cost.comprehension) {
        throw new CreationEngineError(
          `道心感悟不足，需要 ${cost.comprehension} 点`,
        );
      }
    }

    // 扣除灵石
    if (cost.spiritStones) {
      await tx
        .update(cultivators)
        .set({
          spirit_stones: sql`${cultivators.spirit_stones} - ${cost.spiritStones}`,
        })
        .where(eq(cultivators.id, cultivator.id!));
    }

    // 扣除感悟
    if (cost.comprehension) {
      // JSONB 更新 comprehension_insight
      await tx
        .update(cultivators)
        .set({
          cultivation_progress: sql`jsonb_set(
            coalesce(cultivation_progress, '{}'::jsonb),
            '{comprehension_insight}',
            to_jsonb(coalesce((cultivation_progress->>'comprehension_insight')::int, 0) - ${cost.comprehension})
          )`,
        })
        .where(eq(cultivators.id, cultivator.id!));
    }
  }
}
