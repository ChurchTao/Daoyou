import { db, DbTransaction } from '@/lib/drizzle/db';
import { materials } from '@/lib/drizzle/schema';
import { redis } from '@/lib/redis';
import { getCultivatorById } from '@/lib/repositories/cultivatorRepository';
import { Material } from '@/types/cultivator';
import { object } from '@/utils/aiClient';
import { eq, inArray, sql } from 'drizzle-orm';
import { CreationContext } from './CreationStrategy';
import { AlchemyStrategy } from './strategies/AlchemyStrategy';
import { RefiningStrategy } from './strategies/RefiningStrategy';

export type SupportedStrategies = RefiningStrategy | AlchemyStrategy;

export class CreationEngine {
  private strategies: Map<string, SupportedStrategies> = new Map();

  constructor() {
    this.registerStrategy(new RefiningStrategy());
    this.registerStrategy(new AlchemyStrategy());
  }

  private registerStrategy(strategy: SupportedStrategies) {
    this.strategies.set(strategy.craftType, strategy);
  }

  /**
   * Process a crafting request end-to-end.
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
      const context: CreationContext = {
        cultivator: cultivator,
        materials: selectedMaterials as unknown as Material[],
        userPrompt: prompt,
      };
      await strategy.validate(context);

      // 5. Construct Prompt & Call AI
      const { system, user } = strategy.constructPrompt(context);

      const aiResponse = await object(system, user, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        schema: strategy.schema as any,
        schemaName: strategy.schemaName,
        schemaDescription: strategy.schemaDescription,
      });

      const resultItem = aiResponse.object;

      // 6. Transaction: Consumption & Persistence
      await db.transaction(async (tx) => {
        // 6.1 Consume Materials
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

        // 6.2 Persist Result (Delegated to Strategy)
        // We cast types because TS cannot correlate that resultItem (from strategy.schema) matches strategy.persistResult's input
        await strategy.persistResult(
          tx as unknown as DbTransaction,
          context,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          resultItem as any,
        );
      });

      return resultItem;
    } finally {
      await redis.del(lockKey);
    }
  }
}
