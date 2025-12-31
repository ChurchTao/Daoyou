import { db, DbTransaction } from '@/lib/drizzle/db';
import { materials } from '@/lib/drizzle/schema';
import { redis } from '@/lib/redis';
import { getCultivatorById } from '@/lib/repositories/cultivatorRepository';
import { Material } from '@/types/cultivator';
import { object } from '@/utils/aiClient';
import { sanitizePrompt } from '@/utils/prompts';
import { eq, inArray, sql } from 'drizzle-orm';
import { CreationStrategy } from './CreationStrategy';
import { AlchemyStrategy } from './strategies/AlchemyStrategy';
import { RefiningStrategy } from './strategies/RefiningStrategy';
import { SkillCreationStrategy } from './strategies/SkillCreationStrategy';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupportedStrategies = CreationStrategy<any, any>;

export class CreationEngine {
  private strategies: Map<string, SupportedStrategies> = new Map();

  constructor() {
    this.registerStrategy(new RefiningStrategy());
    this.registerStrategy(new AlchemyStrategy());
    this.registerStrategy(new SkillCreationStrategy());
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
      throw new Error('炉火正旺，道友莫急');
    }

    try {
      // 2. Load Data & Validate Ownership
      // 2.1 Materials
      const selectedMaterials = await db
        .select()
        .from(materials)
        .where(inArray(materials.id, materialIds));

      if (selectedMaterials.length !== materialIds.length) {
        throw new Error('部分材料已耗尽或不存在');
      }

      for (const mat of selectedMaterials) {
        if (mat.cultivatorId !== cultivatorId) {
          throw new Error('非本人材料，不可动用');
        }
      }

      // 2.2 Cultivator
      const cultivator = await getCultivatorById(userId, cultivatorId);

      if (!cultivator) {
        throw new Error('道友查无此人');
      }

      // 3. Select Strategy
      const strategy = this.strategies.get(craftType);
      if (!strategy) {
        throw new Error(`未知的造物类型: ${craftType}`);
      }

      // 4. Strategy Validation
      const context = {
        cultivator: cultivator,
        materials: selectedMaterials as unknown as Material[],
        userPrompt: sanitizePrompt(prompt),
      };
      await strategy.validate(context);

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
      await db.transaction(async (tx) => {
        // 7.1 Consume Materials
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

        // 7.2 Persist Result (Delegated to Strategy)
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
}
