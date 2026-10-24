import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db.js';
import * as schema from '@server/lib/drizzle/schema.js';
import {
  updateCultivationExp,
  updateLifespan,
  updateReputation,
  updateSpiritStones,
} from '@server/cultivator/application/readers/CultivatorStateRepository.js';
import type {
  ResourceOperation,
  ResourceOperationResult,
  ResourceOperationSettlement,
  ResourceValidationResult,
} from '@daoyou/game-domain/resources';
import { getGameConceptLabel } from '@daoyou/game-content/presentation/concepts';
import { and, eq } from 'drizzle-orm';

function createSettlement(): ResourceOperationSettlement {
  return { inventoryChanges: [] };
}

function assertOperations(
  operations: ResourceOperation[],
  kind: 'cost' | 'gain',
): string | null {
  for (const operation of operations) {
    if (!Number.isFinite(operation.value)) {
      return `非法的资源数值: ${operation.type}=${operation.value}（必须为有限数）`;
    }
    if (operation.value < 0) {
      return `非法的负值${kind === 'cost' ? '成本' : '收益'}: ${operation.type}=${operation.value}`;
    }
  }
  return null;
}

/**
 * 事务内基础资源执行器。
 *
 * 只处理余额与物品的原子增减，不开启事务、不接收业务回调，也不负责任务、
 * 邮件、宗门或副本编排。调用方必须通过 feature command 传入现有事务。
 */
export class ResourceEngine {
  async validate(
    userId: string,
    cultivatorId: string,
    requirements: ResourceOperation[],
    q: DbExecutor | DbTransaction,
  ): Promise<ResourceValidationResult> {
    const invalid = assertOperations(requirements, 'cost');
    if (invalid) return { valid: false, errors: [invalid] };

    const [cultivator] = await q
      .select({
        spiritStones: schema.cultivators.spirit_stones,
        reputation: schema.cultivators.reputation,
        lifespan: schema.cultivators.lifespan,
        cultivationProgress: schema.cultivators.cultivation_progress,
      })
      .from(schema.cultivators)
      .where(
        and(
          eq(schema.cultivators.id, cultivatorId),
          eq(schema.cultivators.userId, userId),
          eq(schema.cultivators.status, 'active'),
        ),
      )
      .limit(1);
    if (!cultivator) return { valid: false, errors: ['修真者不存在'] };

    const progress = cultivator.cultivationProgress as {
      cultivation_exp?: number;
      comprehension_insight?: number;
    } | null;
    const missing: ResourceOperation[] = [];
    const errors: string[] = [];
    for (const requirement of requirements) {
      let current: number | null = null;
      let label = '';
      switch (requirement.type) {
        case 'spirit_stones':
          current = cultivator.spiritStones;
          label = getGameConceptLabel('spirit_stones');
          break;
        case 'reputation':
          current = cultivator.reputation ?? 0;
          label = getGameConceptLabel('reputation');
          break;
        case 'lifespan':
          current = cultivator.lifespan;
          label = getGameConceptLabel('lifespan');
          break;
        case 'cultivation_exp':
          current = progress?.cultivation_exp ?? 0;
          label = getGameConceptLabel('cultivation_exp');
          break;
        case 'comprehension_insight':
          current = progress?.comprehension_insight ?? 0;
          label = getGameConceptLabel('comprehension_insight');
          break;
        case 'material':
        case 'hp_loss':
        case 'mp_loss':
        case 'battle':
        case 'artifact':
        case 'consumable':
          continue;
      }
      if (current !== null && current < requirement.value) {
        missing.push(requirement);
        errors.push(
          `${label}不足，需要 ${requirement.value}，当前拥有 ${current}`,
        );
      }
    }
    return {
      valid: missing.length === 0,
      missing: missing.length ? missing : undefined,
      errors: errors.length ? errors : undefined,
    };
  }

  async applyInTransaction(args: {
    userId: string;
    cultivatorId: string;
    tx: DbTransaction;
    consume?: ResourceOperation[];
    gain?: ResourceOperation[];
  }): Promise<ResourceOperationResult> {
    const consume = args.consume ?? [];
    const gain = args.gain ?? [];
    const operations = [...consume, ...gain];
    const invalidGain = assertOperations(gain, 'gain');
    if (invalidGain) {
      return { success: false, operations, errors: [invalidGain] };
    }
    if (consume.length) {
      const validation = await this.validate(
        args.userId,
        args.cultivatorId,
        consume,
        args.tx,
      );
      if (!validation.valid) {
        return {
          success: false,
          operations,
          errors: validation.errors,
        };
      }
    }

    const settlement = createSettlement();
    let depleted = false;
    for (const operation of consume) {
      switch (operation.type) {
        case 'spirit_stones':
          settlement.spiritStones = await updateSpiritStones(
            args.userId,
            args.cultivatorId,
            -operation.value,
            args.tx,
          );
          break;
        case 'reputation':
          settlement.reputation = await updateReputation(
            args.userId,
            args.cultivatorId,
            -operation.value,
            args.tx,
          );
          break;
        case 'lifespan': {
          settlement.lifespan = await updateLifespan(
            args.userId,
            args.cultivatorId,
            -operation.value,
            args.tx,
          );
          const [state] = await args.tx
            .select({
              age: schema.cultivators.age,
              lifespan: schema.cultivators.lifespan,
              status: schema.cultivators.status,
            })
            .from(schema.cultivators)
            .where(eq(schema.cultivators.id, args.cultivatorId))
            .limit(1);
          if (state?.status === 'active' && state.age >= state.lifespan) {
            await args.tx
              .update(schema.cultivators)
              .set({ status: 'dead' })
              .where(eq(schema.cultivators.id, args.cultivatorId));
            depleted = true;
          }
          break;
        }
        case 'cultivation_exp':
          settlement.cultivationProgress = await updateCultivationExp(
            args.userId,
            args.cultivatorId,
            -operation.value,
            undefined,
            args.tx,
          );
          break;
        case 'comprehension_insight':
          settlement.cultivationProgress = await updateCultivationExp(
            args.userId,
            args.cultivatorId,
            0,
            -operation.value,
            args.tx,
          );
          break;
        case 'material':
        case 'hp_loss':
        case 'mp_loss':
        case 'battle':
        case 'artifact':
        case 'consumable':
          break;
      }
    }

    for (const operation of gain) {
      switch (operation.type) {
        case 'spirit_stones':
          settlement.spiritStones = await updateSpiritStones(
            args.userId,
            args.cultivatorId,
            operation.value,
            args.tx,
          );
          break;
        case 'reputation':
          settlement.reputation = await updateReputation(
            args.userId,
            args.cultivatorId,
            operation.value,
            args.tx,
          );
          break;
        case 'lifespan':
          settlement.lifespan = await updateLifespan(
            args.userId,
            args.cultivatorId,
            operation.value,
            args.tx,
          );
          break;
        case 'cultivation_exp':
          settlement.cultivationProgress = await updateCultivationExp(
            args.userId,
            args.cultivatorId,
            operation.value,
            undefined,
            args.tx,
          );
          break;
        case 'comprehension_insight':
          settlement.cultivationProgress = await updateCultivationExp(
            args.userId,
            args.cultivatorId,
            0,
            operation.value,
            args.tx,
          );
          break;
        case 'material':
        case 'artifact':
        case 'consumable':
          return {
            success: false,
            operations,
            errors: ['旧藏宝库已停止入库'],
          };
        case 'hp_loss':
        case 'mp_loss':
        case 'battle':
          break;
      }
    }

    if (depleted) settlement.activeCultivatorDepleted = true;
    return { success: true, operations, settlement };
  }
}

export const resourceEngine = new ResourceEngine();
