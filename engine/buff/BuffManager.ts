import type { BaseEffect } from '../effect/BaseEffect';
import type { Entity } from '../effect/types';
import { BuffInstance } from './BuffInstance';
import { buffRegistry } from './BuffRegistry';
import type { BuffConfig, BuffEvent, BuffInstanceState } from './types';
import { BuffEventType, BuffStackType, BuffTag } from './types';

/**
 * Buff 管理器
 * 管理单个实体身上的所有 Buff
 */
export class BuffManager {
  /** 按 Buff ID 索引的实例 (非 INDEPENDENT 类型) */
  private buffsById: Map<string, BuffInstance> = new Map();
  /** 所有 Buff 实例列表 (包括 INDEPENDENT 类型) */
  private allBuffs: BuffInstance[] = [];
  /** 事件日志 */
  private eventLog: BuffEvent[] = [];

  constructor(private owner: Entity) {}

  /**
   * 施加 Buff
   * @param configOrId Buff 配置或配置 ID
   * @param caster 施法者
   * @param options 可选参数
   */
  addBuff(
    configOrId: BuffConfig | string,
    caster: Entity,
    options: {
      initialStacks?: number;
      durationOverride?: number;
    } = {},
  ): BuffEvent {
    // 获取配置
    const config =
      typeof configOrId === 'string'
        ? buffRegistry.get(configOrId)
        : configOrId;

    if (!config) {
      return {
        type: BuffEventType.RESISTED,
        buffId: typeof configOrId === 'string' ? configOrId : 'unknown',
        ownerId: this.owner.id,
        message: `未找到 Buff 配置: ${configOrId}`,
      };
    }

    // 处理互斥
    if (config.conflictsWith?.length) {
      for (const conflictId of config.conflictsWith) {
        this.removeBuff(conflictId);
      }
    }

    // 检查是否已存在
    const existing = this.buffsById.get(config.id);

    if (existing && config.stackType !== BuffStackType.INDEPENDENT) {
      // 叠加或刷新
      const stacked = existing.addStack();
      const event: BuffEvent = {
        type: stacked ? BuffEventType.STACKED : BuffEventType.REFRESHED,
        buffId: config.id,
        instanceId: existing.instanceId,
        ownerId: this.owner.id,
        casterId: caster.id,
        stacks: existing.currentStacks,
        remainingTurns: existing.remainingTurns,
        message: stacked
          ? `${this.owner.name} 的「${config.name}」叠加至 ${existing.currentStacks} 层`
          : `${this.owner.name} 的「${config.name}」持续时间刷新`,
      };
      this.eventLog.push(event);
      return event;
    }

    // 创建新实例
    const instance = new BuffInstance(
      config,
      caster,
      this.owner,
      options.initialStacks,
      options.durationOverride,
    );

    // 注册
    if (config.stackType !== BuffStackType.INDEPENDENT) {
      this.buffsById.set(config.id, instance);
    }
    this.allBuffs.push(instance);

    const event: BuffEvent = {
      type: BuffEventType.APPLIED,
      buffId: config.id,
      instanceId: instance.instanceId,
      ownerId: this.owner.id,
      casterId: caster.id,
      stacks: instance.currentStacks,
      remainingTurns: instance.remainingTurns,
      message: `${this.owner.name} 获得了「${config.name}」`,
    };
    this.eventLog.push(event);
    return event;
  }

  /**
   * 移除 Buff
   * @param buffId Buff 配置 ID
   * @returns 移除的实例数量
   */
  removeBuff(buffId: string): number {
    let removed = 0;

    // 移除按 ID 索引的
    if (this.buffsById.has(buffId)) {
      this.buffsById.delete(buffId);
      removed++;
    }

    // 移除 allBuffs 中的
    const before = this.allBuffs.length;
    this.allBuffs = this.allBuffs.filter((b) => b.config.id !== buffId);
    removed += before - this.allBuffs.length;

    if (removed > 0) {
      const config = buffRegistry.get(buffId);
      this.eventLog.push({
        type: BuffEventType.REMOVED,
        buffId,
        ownerId: this.owner.id,
        message: `${this.owner.name} 的「${config?.name ?? buffId}」被移除`,
      });
    }

    return removed;
  }

  /**
   * 回合流逝 (Tick)
   * @returns 过期的 Buff 事件列表
   */
  tick(): BuffEvent[] {
    const expiredEvents: BuffEvent[] = [];

    const expired: BuffInstance[] = [];
    for (const buff of this.allBuffs) {
      if (buff.tick()) {
        expired.push(buff);
      }
    }

    for (const buff of expired) {
      // 移除过期的
      this.buffsById.delete(buff.config.id);
      this.allBuffs = this.allBuffs.filter(
        (b) => b.instanceId !== buff.instanceId,
      );

      const event: BuffEvent = {
        type: BuffEventType.EXPIRED,
        buffId: buff.config.id,
        instanceId: buff.instanceId,
        ownerId: this.owner.id,
        message: `${this.owner.name} 的「${buff.config.name}」消退`,
      };
      this.eventLog.push(event);
      expiredEvents.push(event);
    }

    return expiredEvents;
  }

  /**
   * 获取所有 Buff 提供的效果
   */
  getAllEffects(): BaseEffect[] {
    const effects: BaseEffect[] = [];
    for (const buff of this.allBuffs) {
      effects.push(...buff.getEffects());
    }
    return effects;
  }

  /**
   * 检查是否拥有指定 Buff
   */
  hasBuff(buffId: string): boolean {
    return (
      this.buffsById.has(buffId) ||
      this.allBuffs.some((b) => b.config.id === buffId)
    );
  }

  /**
   * 获取指定 Buff 实例
   */
  getBuff(buffId: string): BuffInstance | undefined {
    return (
      this.buffsById.get(buffId) ||
      this.allBuffs.find((b) => b.config.id === buffId)
    );
  }

  /**
   * 获取指定 Buff 的层数
   */
  getStacks(buffId: string): number {
    const buff = this.getBuff(buffId);
    return buff?.currentStacks ?? 0;
  }

  /**
   * 获取所有活跃的 Buff
   */
  getActiveBuffs(): BuffInstance[] {
    return [...this.allBuffs];
  }

  /**
   * 按标签过滤 Buff
   */
  getBuffsByTag(tag: BuffTag): BuffInstance[] {
    return this.allBuffs.filter((b) => b.config.tags?.includes(tag));
  }

  /**
   * 清除指定标签的 Buff
   */
  clearBuffsByTag(tag: BuffTag): number {
    const toRemove = this.getBuffsByTag(tag).map((b) => b.config.id);
    let count = 0;
    for (const id of toRemove) {
      count += this.removeBuff(id);
    }
    return count;
  }

  /**
   * 清除所有 Buff
   */
  clearAll(): void {
    this.buffsById.clear();
    this.allBuffs = [];
  }

  /**
   * 获取事件日志
   */
  getEventLog(): BuffEvent[] {
    return [...this.eventLog];
  }

  /**
   * 清空事件日志
   */
  clearEventLog(): void {
    this.eventLog = [];
  }

  /**
   * 导出状态 (用于序列化)
   */
  toState(): BuffInstanceState[] {
    return this.allBuffs.map((b) => b.toState());
  }

  /**
   * 从状态恢复 (用于反序列化)
   */
  fromState(
    states: BuffInstanceState[],
    getCaster: (casterId: string) => Entity | undefined,
  ): void {
    this.clearAll();

    for (const state of states) {
      const config = buffRegistry.get(state.configId);
      if (!config) continue;

      const caster = state.casterId
        ? getCaster(state.casterId) || this.owner
        : this.owner;
      const instance = new BuffInstance(
        config,
        caster,
        this.owner,
        state.currentStacks,
        state.remainingTurns,
      );

      if (config.stackType !== BuffStackType.INDEPENDENT) {
        this.buffsById.set(config.id, instance);
      }
      this.allBuffs.push(instance);
    }
  }
}
