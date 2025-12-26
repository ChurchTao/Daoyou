import type { StatusEffect } from '@/types/constants';
import { randomUUID } from 'crypto';
import {
  attributeModifierCalculator,
  damageOverTimeCalculator,
  resistanceCalculator,
} from './calculators';
import { statusRegistry } from './StatusRegistry';
import type {
  ApplyResult,
  AttributeModification,
  CalculationContext,
  StatusApplicationRequest,
  StatusInstance,
  StatusType,
  TickContext,
  TickResult,
  UnitSnapshot,
} from './types';

/**
 * 状态容器
 * 负责管理单个角色的所有临时状态
 */
export class StatusContainer {
  // 按ID索引的状态
  private statusesById: Map<string, StatusInstance> = new Map();
  // 按Key索引的状态(支持叠加)
  private statusesByKey: Map<StatusEffect, StatusInstance[]> = new Map();

  /**
   * 添加状态
   */
  addStatus(
    request: StatusApplicationRequest,
    target: UnitSnapshot,
  ): ApplyResult {
    // 1. 验证statusKey合法性
    const definition = statusRegistry.getDefinition(request.statusKey);
    if (!definition) {
      return {
        success: false,
        message: `未知的状态类型: ${request.statusKey}`,
      };
    }

    // 2. 抵抗判定(仅对debuff和control类型)
    if (
      definition.statusType === 'debuff' ||
      definition.statusType === 'control'
    ) {
      const attackerWillpower =
        request.source.casterSnapshot?.attributes.willpower ?? 0;
      const defenderWillpower = target.baseAttributes.willpower;
      const potency = request.potency ?? definition.defaultPotency;

      const resistChance = resistanceCalculator.calculateResistance(
        attackerWillpower,
        defenderWillpower,
        potency,
      );

      if (Math.random() < resistChance) {
        return {
          success: false,
          resistedByWillpower: true,
          message: `${target.unitId} 抵抗了「${definition.displayName}」`,
        };
      }
    }

    // 3. 检查并移除互斥状态
    if (definition.conflictsWith?.length) {
      for (const conflictKey of definition.conflictsWith) {
        this.removeStatusByKey(conflictKey);
      }
    }

    // 4. 检查叠加规则
    const existing = this.statusesByKey.get(request.statusKey);
    if (existing && existing.length > 0) {
      if (!definition.stackable) {
        // 不可叠加:刷新现有状态
        const existingStatus = existing[0];
        existingStatus.duration.remaining =
          request.durationOverride?.remaining ??
          definition.defaultDuration.remaining;
        existingStatus.duration.total =
          request.durationOverride?.total ?? definition.defaultDuration.total;
        existingStatus.potency = request.potency ?? definition.defaultPotency;
        return {
          success: true,
          statusId: existingStatus.statusId,
          message: `刷新了「${definition.displayName}」`,
        };
      } else {
        // 可叠加:检查是否达到上限
        if (existing.length >= definition.maxStack) {
          return {
            success: false,
            message: `「${definition.displayName}」已达最大叠加层数`,
          };
        }
      }
    }

    // 5. 生成StatusInstance
    const statusId = randomUUID();
    const duration = request.durationOverride
      ? { ...definition.defaultDuration, ...request.durationOverride }
      : { ...definition.defaultDuration };

    const statusInstance: StatusInstance = {
      statusId,
      statusType: definition.statusType,
      statusKey: request.statusKey,
      displayName: definition.displayName,
      description: definition.description,
      source: request.source,
      duration,
      potency: request.potency ?? definition.defaultPotency,
      stackable: definition.stackable,
      maxStack: definition.maxStack,
      currentStack: request.stackToAdd ?? 1,
      element: request.element ?? definition.element,
      metadata: request.metadata ?? {},
      createdAt: Date.now(),
    };

    // 5. 注册到容器
    this.statusesById.set(statusId, statusInstance);
    const keyStatuses = this.statusesByKey.get(request.statusKey) ?? [];
    keyStatuses.push(statusInstance);
    this.statusesByKey.set(request.statusKey, keyStatuses);

    return {
      success: true,
      statusId,
      message: `施加了「${definition.displayName}」`,
    };
  }

  /**
   * 移除指定ID的状态
   */
  removeStatus(statusId: string): boolean {
    const status = this.statusesById.get(statusId);
    if (!status) return false;

    this.statusesById.delete(statusId);

    const keyStatuses = this.statusesByKey.get(status.statusKey);
    if (keyStatuses) {
      const index = keyStatuses.findIndex((s) => s.statusId === statusId);
      if (index !== -1) {
        keyStatuses.splice(index, 1);
      }
      if (keyStatuses.length === 0) {
        this.statusesByKey.delete(status.statusKey);
      }
    }

    return true;
  }

  /**
   * 移除指定Key的所有状态
   */
  removeStatusByKey(statusKey: StatusEffect): number {
    const statuses = this.statusesByKey.get(statusKey);
    if (!statuses) return 0;

    const count = statuses.length;
    for (const status of statuses) {
      this.statusesById.delete(status.statusId);
    }
    this.statusesByKey.delete(statusKey);

    return count;
  }

  /**
   * 检查是否存在某状态
   */
  hasStatus(statusKey: StatusEffect): boolean {
    const statuses = this.statusesByKey.get(statusKey);
    return statuses !== undefined && statuses.length > 0;
  }

  /**
   * 获取状态实例
   */
  getStatus(statusKey: StatusEffect): StatusInstance | undefined {
    const statuses = this.statusesByKey.get(statusKey);
    return statuses?.[0];
  }

  /**
   * 获取所有活动状态
   */
  getActiveStatuses(): StatusInstance[] {
    return Array.from(this.statusesById.values());
  }

  /**
   * 刷新状态(每回合调用)
   */
  tickStatuses(context: TickContext): TickResult {
    const result: TickResult = {
      damageDealt: 0,
      healingDone: 0,
      expiredStatuses: [],
      effectLogs: [],
    };

    const toRemove: string[] = [];
    const statuses = this.getSortedStatuses();

    // 用于合并相同statusKey的DOT伤害日志
    const dotDamageByKey = new Map<
      StatusEffect,
      { damage: number; count: number }
    >();

    for (const status of statuses) {
      // 1. 检查durationType并递减
      if (status.duration.durationType === 'turn') {
        status.duration.remaining -= 1;
      } else if (status.duration.durationType === 'realtime') {
        const elapsed = context.currentTime - status.createdAt;
        status.duration.remaining = status.duration.total - elapsed;
      }

      // 2. 触发持续效果(DOT)
      if (status.statusType === 'dot') {
        const calcContext: CalculationContext = {
          target: context.unitSnapshot,
          caster: status.source.casterSnapshot,
          battleContext: context.battleContext,
        };

        const damage = damageOverTimeCalculator.calculateDamageOverTime(
          status,
          calcContext,
        );

        if (damage > 0) {
          result.damageDealt += damage;

          // 累计相同statusKey的伤害
          const existing = dotDamageByKey.get(status.statusKey) || {
            damage: 0,
            count: 0,
          };
          existing.damage += damage;
          existing.count += 1;
          dotDamageByKey.set(status.statusKey, existing);
        }
      }

      // 3. 检查是否过期
      if (
        status.duration.durationType !== 'permanent' &&
        status.duration.remaining <= 0
      ) {
        toRemove.push(status.statusId);
        result.expiredStatuses.push(status.statusId);
        result.effectLogs.push(
          `${context.unitName} 的「${status.displayName}」效果消退`,
        );
      }
    }

    // 生成合并后的DOT伤害日志
    for (const [statusKey, { damage, count }] of dotDamageByKey.entries()) {
      const definition = statusRegistry.getDefinition(statusKey);
      const displayName = definition?.displayName || statusKey;

      if (count > 1) {
        result.effectLogs.push(
          `${context.unitName} 受到「${displayName}」影响（${count}层），损失 ${damage} 点气血`,
        );
      } else {
        result.effectLogs.push(
          `${context.unitName} 受到「${displayName}」影响，损失 ${damage} 点气血`,
        );
      }
    }

    // 4. 移除过期状态
    for (const statusId of toRemove) {
      this.removeStatus(statusId);
    }

    return result;
  }

  /**
   * 清除特定类型的状态
   */
  clearStatusesByType(statusTypes: StatusType | StatusType[]): number {
    const types = Array.isArray(statusTypes) ? statusTypes : [statusTypes];
    const toRemove: string[] = [];

    for (const status of this.statusesById.values()) {
      if (types.includes(status.statusType)) {
        toRemove.push(status.statusId);
      }
    }

    for (const statusId of toRemove) {
      this.removeStatus(statusId);
    }

    return toRemove.length;
  }

  /**
   * 清除所有状态
   */
  clearAllStatuses(): void {
    this.statusesById.clear();
    this.statusesByKey.clear();
  }

  /**
   * 计算属性修正
   */
  calculateAttributeModifications(
    context: CalculationContext,
  ): AttributeModification {
    const modification: AttributeModification = {
      vitality: 0,
      spirit: 0,
      wisdom: 0,
      speed: 0,
      willpower: 0,
    };

    for (const status of this.statusesById.values()) {
      const statusMod =
        attributeModifierCalculator.calculateAttributeModification(
          status,
          context,
        );

      if (statusMod) {
        modification.vitality += statusMod.vitality ?? 0;
        modification.spirit += statusMod.spirit ?? 0;
        modification.wisdom += statusMod.wisdom ?? 0;
        modification.speed += statusMod.speed ?? 0;
        modification.willpower += statusMod.willpower ?? 0;
      }
    }

    return modification;
  }

  /**
   * 获取排序后的状态列表(按优先级)
   */
  private getSortedStatuses(): StatusInstance[] {
    const statuses = Array.from(this.statusesById.values());

    // 优先级: control > buff/debuff > dot > persistent > environmental
    const priority: Record<StatusType, number> = {
      control: 1,
      buff: 2,
      debuff: 2,
      dot: 3,
      persistent: 4,
      environmental: 5,
    };

    return statuses.sort((a, b) => {
      return priority[a.statusType] - priority[b.statusType];
    });
  }

  /**
   * 序列化为JSON(用于存储)
   */
  toJSON(): StatusInstance[] {
    return Array.from(this.statusesById.values());
  }

  /**
   * 从JSON恢复(用于加载)
   */
  fromJSON(statuses: StatusInstance[]): void {
    this.clearAllStatuses();

    for (const status of statuses) {
      this.statusesById.set(status.statusId, status);

      const keyStatuses = this.statusesByKey.get(status.statusKey) ?? [];
      keyStatuses.push(status);
      this.statusesByKey.set(status.statusKey, keyStatuses);
    }
  }

  /**
   * 导出持久状态(用于数据库存储)
   * 过滤出statusType为persistent的状态，并简化为数据库格式
   */
  exportPersistentStatuses(): Array<{
    statusKey: string;
    potency: number;
    createdAt: number;
    metadata: Record<string, unknown>;
  }> {
    const persistent = Array.from(this.statusesById.values()).filter(
      (status) => status.statusType === 'persistent',
    );

    return persistent.map((status) => ({
      statusKey: status.statusKey,
      potency: status.potency,
      createdAt: status.createdAt,
      metadata: status.metadata,
    }));
  }

  /**
   * 加载持久状态(从数据库恢复)
   * 从简化格式恢复为StatusInstance并添加到容器
   */
  loadPersistentStatuses(
    persistentStatuses: Array<{
      statusKey: string;
      potency: number;
      createdAt: number;
      metadata: Record<string, unknown>;
    }>,
    target: UnitSnapshot,
  ): void {
    for (const saved of persistentStatuses) {
      const definition = statusRegistry.getDefinition(
        saved.statusKey as StatusEffect,
      );
      if (!definition) {
        console.warn(`未知的持久状态: ${saved.statusKey}`);
        continue;
      }

      // 构造状态应用请求
      const request: StatusApplicationRequest = {
        statusKey: saved.statusKey as StatusEffect,
        source: {
          sourceType: 'system',
          sourceName: '持久化状态',
        },
        potency: saved.potency,
        metadata: saved.metadata,
      };

      // 添加状态（跳过抵抗判定）
      this.addStatus(request, target);
    }
  }

  /**
   * 清除临时状态(仅移除非persistent类型的状态)
   * 用于战斗结束后清理buff/debuff/control/dot状态
   */
  clearTemporaryStatuses(): void {
    const toRemove: string[] = [];

    for (const status of this.statusesById.values()) {
      if (status.statusType !== 'persistent') {
        toRemove.push(status.statusId);
      }
    }

    for (const statusId of toRemove) {
      this.removeStatus(statusId);
    }
  }
}
