import { getExecutor } from '@/lib/drizzle/db';
import {
  addArtifactToInventory,
  addConsumableToInventory,
  addMaterialToInventory,
  getCultivatorByIdUnsafe,
  hasMaterial,
  removeMaterialFromInventory,
  updateCultivationExp,
  updateLifespan,
  updateSpiritStones,
} from '@/lib/services/cultivatorService';
import type { Artifact, Consumable, Material } from '@/types/cultivator';
import type {
  ResourceOperation,
  ResourceOperationResult,
  ResourceTransactionOptions,
  ResourceValidationResult,
} from './types';
import type { DbTransaction } from '@/lib/drizzle/db';

/**
 * 资源管理引擎
 *
 * 提供统一的资源管理接口，支持：
 * - 资源校验
 * - 资源消耗
 * - 资源获得
 * - 事务性批量操作
 */
export class ResourceEngine {
  /**
   * 校验角色是否拥有足够资源
   */
  async validate(
    userId: string,
    cultivatorId: string,
    requirements: ResourceOperation[],
  ): Promise<ResourceValidationResult> {
    const missing: ResourceOperation[] = [];
    const errors: string[] = [];

    try {
      const cultivatorBundle = await getCultivatorByIdUnsafe(cultivatorId);
      if (!cultivatorBundle || !cultivatorBundle.cultivator) {
        return {
          valid: false,
          errors: ['修真者不存在'],
        };
      }

      const cultivator = cultivatorBundle.cultivator;

      for (const req of requirements) {
        switch (req.type) {
          case 'spirit_stones':
            if (cultivator.spirit_stones < req.value) {
              missing.push(req);
              errors.push(
                `灵石不足，需要 ${req.value}，当前拥有 ${cultivator.spirit_stones}`,
              );
            }
            break;

          case 'lifespan':
            if (cultivator.lifespan < req.value) {
              missing.push(req);
              errors.push(
                `寿元不足，需要 ${req.value}，当前剩余 ${cultivator.lifespan}`,
              );
            }
            break;

          case 'cultivation_exp':
            if (
              cultivator.cultivation_progress &&
              cultivator.cultivation_progress.cultivation_exp < req.value
            ) {
              missing.push(req);
              errors.push(
                `修为不足，需要 ${req.value}，当前修为 ${cultivator.cultivation_progress.cultivation_exp}`,
              );
            }
            break;

          case 'material':
            if (req.name) {
              const has = await hasMaterial(
                userId,
                cultivatorId,
                req.name,
                req.value,
              );
              if (!has) {
                missing.push(req);
                errors.push(`材料 ${req.name} 不足，需要 ${req.value}`);
              }
            }
            break;

          // 法宝和消耗品在消耗时才校验
          case 'hp_loss':
          case 'mp_loss':
          case 'weak':
          case 'battle':
          case 'artifact_damage':
          case 'artifact':
          case 'consumable':
          case 'comprehension_insight':
            // 暂不校验
            break;

          default:
            errors.push(`未知的资源类型: ${req.type}`);
        }
      }

      return {
        valid: missing.length === 0 && errors.length === 0,
        missing: missing.length > 0 ? missing : undefined,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          `校验资源时发生错误: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }

  /**
   * 消耗资源
   * @param action 可选的回调函数，在资源扣除后执行。如果失败会回滚资源扣除
   */
  async consume(
    userId: string,
    cultivatorId: string,
    costs: ResourceOperation[],
    action?: (tx: DbTransaction) => Promise<void>,
    dryRun = false,
  ): Promise<ResourceOperationResult> {
    // 先校验资源是否充足
    const validation = await this.validate(userId, cultivatorId, costs);
    if (!validation.valid) {
      return {
        success: false,
        operations: costs,
        errors: validation.errors,
      };
    }

    // 如果是干运行模式，只校验不执行
    if (dryRun) {
      return {
        success: true,
        operations: costs,
      };
    }

    // 执行资源消耗（在事务中）
    const errors: string[] = [];

    try {
      await getExecutor().transaction(async (tx) => {
        // 1. 扣除资源
        for (const cost of costs) {
          switch (cost.type) {
            case 'spirit_stones':
              await updateSpiritStones(userId, cultivatorId, -cost.value, tx);
              break;

            case 'lifespan':
              await updateLifespan(userId, cultivatorId, -cost.value, tx);
              break;

            case 'cultivation_exp':
              await updateCultivationExp(
                userId,
                cultivatorId,
                -cost.value,
                undefined,
                tx,
              );
              break;

            case 'comprehension_insight':
              // 只修改感悟值，修为变化为0
              await updateCultivationExp(
                userId,
                cultivatorId,
                0,
                -cost.value,
                tx,
              );
              break;

            case 'material':
              if (cost.name) {
                await removeMaterialFromInventory(
                  userId,
                  cultivatorId,
                  cost.name,
                  cost.value,
                  tx,
                );
              }
              break;

            // 副本特有类型，不在资源引擎中处理，由副本系统内部处理
            case 'hp_loss':
            case 'mp_loss':
            case 'weak':
            case 'battle':
            case 'artifact_damage':
              // 这些类型不消耗实际资源，跳过
              break;

            default:
              errors.push(`未知的资源类型: ${cost.type}`);
          }
        }

        // 2. 如果提供了action，执行它
        // 如果action失败，会抛出异常，导致事务回滚
        if (action) {
          await action(tx);
        }
      });

      return {
        success: errors.length === 0,
        operations: costs,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        success: false,
        operations: costs,
        errors: [
          `操作失败已回滚: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }

  /**
   * 获得资源
   * @param action 可选的回调函数，在资源获取后执行。如果失败会回滚资源获取
   */
  async gain(
    userId: string,
    cultivatorId: string,
    gains: ResourceOperation[],
    action?: (tx: DbTransaction) => Promise<void>,
    dryRun = false,
  ): Promise<ResourceOperationResult> {
    // 如果是干运行模式，直接返回成功
    if (dryRun) {
      return {
        success: true,
        operations: gains,
      };
    }

    const errors: string[] = [];

    try {
      await getExecutor().transaction(async (tx) => {
        // 1. 获取资源
        for (const gain of gains) {
          switch (gain.type) {
            case 'spirit_stones':
              await updateSpiritStones(userId, cultivatorId, gain.value, tx);
              break;

            case 'lifespan':
              await updateLifespan(userId, cultivatorId, gain.value, tx);
              break;

            case 'cultivation_exp':
              await updateCultivationExp(
                userId,
                cultivatorId,
                gain.value,
                undefined,
                tx,
              );
              break;

            case 'comprehension_insight':
              // 只修改感悟值，修为变化为0
              await updateCultivationExp(
                userId,
                cultivatorId,
                0,
                gain.value,
                tx,
              );
              break;

            case 'material':
              if (gain.data && 'name' in gain.data) {
                // Ensure the material's quantity matches the operation value
                const material = { ...gain.data } as Material;
                material.quantity = gain.value;
                await addMaterialToInventory(
                  userId,
                  cultivatorId,
                  material,
                  tx,
                );
              } else {
                errors.push('材料数据不完整，缺少 name 字段');
              }
              break;

            case 'artifact':
              if (gain.data && 'name' in gain.data) {
                await addArtifactToInventory(
                  userId,
                  cultivatorId,
                  gain.data as Artifact,
                  tx,
                );
              } else {
                errors.push('法宝数据不完整，缺少 name 字段');
              }
              break;

            case 'consumable':
              if (gain.data && 'name' in gain.data) {
                // Ensure the consumable's quantity matches the operation value
                const consumable = { ...gain.data } as Consumable;
                consumable.quantity = gain.value;
                await addConsumableToInventory(
                  userId,
                  cultivatorId,
                  consumable,
                  tx,
                );
              } else {
                errors.push('消耗品数据不完整，缺少 name 字段');
              }
              break;

            default:
              errors.push(`未知的资源类型: ${gain.type}`);
          }
        }

        // 2. 如果提供了 action，执行它
        // 如果 action 失败，会抛出异常，导致事务回滚
        if (action) {
          await action(tx);
        }
      });

      return {
        success: errors.length === 0,
        operations: gains,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        success: false,
        operations: gains,
        errors: [
          `操作失败已回滚: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }

  /**
   * 事务性批量操作
   * 注意：当前实现不保证真正的数据库事务，需要在未来改进
   */
  async transaction(
    options: ResourceTransactionOptions,
    operations: {
      consume?: ResourceOperation[];
      gain?: ResourceOperation[];
    },
  ): Promise<ResourceOperationResult> {
    const { userId, cultivatorId, dryRun } = options;
    const allOperations: ResourceOperation[] = [
      ...(operations.consume || []),
      ...(operations.gain || []),
    ];

    // 先校验所有消耗操作
    if (operations.consume && operations.consume.length > 0) {
      const validation = await this.validate(
        userId,
        cultivatorId,
        operations.consume,
      );
      if (!validation.valid) {
        return {
          success: false,
          operations: allOperations,
          errors: validation.errors,
        };
      }
    }

    // 如果是干运行模式，直接返回成功
    if (dryRun) {
      return {
        success: true,
        operations: allOperations,
      };
    }

    const errors: string[] = [];

    // 执行消耗操作
    if (operations.consume && operations.consume.length > 0) {
      const consumeResult = await this.consume(
        userId,
        cultivatorId,
        operations.consume,
        undefined, // action
        false, // dryRun
      );
      if (!consumeResult.success) {
        errors.push(...(consumeResult.errors || []));
      }
    }

    // 执行获得操作
    if (operations.gain && operations.gain.length > 0) {
      const gainResult = await this.gain(
        userId,
        cultivatorId,
        operations.gain,
        undefined, // action
        false, // dryRun
      );
      if (!gainResult.success) {
        errors.push(...(gainResult.errors || []));
      }
    }

    return {
      success: errors.length === 0,
      operations: allOperations,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

// 创建全局单例
export const resourceEngine = new ResourceEngine();
