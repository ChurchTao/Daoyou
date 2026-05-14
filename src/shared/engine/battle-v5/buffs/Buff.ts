import { BuffId, BuffType } from '../core/types';
import { Unit } from '../units/Unit';
import { GameplayTagContainer } from '@shared/engine/shared/tag-domain';
import { EventBus } from '../core/EventBus';

// 堆叠规则枚举
export const StackRule = {
  STACK_LAYER: 'stack_layer',
  REFRESH_DURATION: 'refresh_duration',
  OVERRIDE: 'override',
  IGNORE: 'ignore',
} as const;

// 堆叠规则类型
export type StackRule = typeof StackRule[keyof typeof StackRule];

/**
 * BUFF 基类
 *
 * GAS+EDA 架构设计：
 * - Buff 持有 owner 引用，可主动订阅事件
 * - 支持层数机制（大多数 Buff 都有层数概念）
 * - 生命周期：setOwner() → onActivate() → [事件响应] → onDeactivate()
 *
 * 实现方式：
 * - 子类重写 onActivate() 订阅事件、添加属性修改器
 * - 子类重写 onDeactivate() 取消订阅、移除属性修改器
 * - 使用 _subscribeEvent() 辅助方法订阅事件（自动存储引用便于取消）
 */
export class Buff {
  readonly id: BuffId;
  readonly name: string;
  readonly type: BuffType;
  private _duration: number;
  private _maxDuration: number;

  // GAS 核心：标签和堆叠规则
  tags: GameplayTagContainer;
  readonly stackRule: StackRule;

  // GAS 核心：owner 引用，用于事件订阅
  protected _owner: Unit | null = null;

  // GAS 核心：source 引用，记录 Buff 来源（施法者/技能）
  protected _source: Unit | null = null;

  // 层数机制（大多数 Buff 都有层数概念）
  protected _layer: number = 1;

  // 事件订阅存储（用于取消订阅）
  protected _subscribedHandlers: Array<{
    eventType: string;
    handler: (event: unknown) => void;
  }> = [];

  constructor(
    id: BuffId,
    name: string,
    type: BuffType,
    duration: number,
    stackRule: StackRule = StackRule.REFRESH_DURATION
  ) {
    this.id = id;
    this.name = name;
    this.type = type;
    this._maxDuration = duration;
    this._duration = duration;
    this.stackRule = stackRule;

    // 初始化标签容器
    this.tags = new GameplayTagContainer();
  }

  /**
   * 设置 owner 引用（由 BuffContainer 调用）
   * 这是 GAS 架构的关键：Buff 需要知道自己的宿主才能订阅事件
   */
  setOwner(owner: Unit): void {
    this._owner = owner;
  }

  /**
   * 获取 owner
   */
  getOwner(): Unit | null {
    return this._owner;
  }

  /**
   * 设置 source 引用（Buff 来源，通常是施法者）
   * 用于 DOT 伤害归属、伤害加成计算等
   */
  setSource(source: Unit | null): void {
    this._source = source;
  }

  /**
   * 获取 source（Buff 来源）
   */
  getSource(): Unit | null {
    return this._source;
  }

  /**
   * 获取当前层数
   */
  getLayer(): number {
    return this._layer;
  }

  /**
   * 增加层数
   * @param layers 增加的层数，默认为 1
   */
  addLayer(layers: number = 1): void {
    this._layer += layers;
  }

  /**
   * 设置层数
   */
  setLayer(layer: number): void {
    this._layer = Math.max(1, layer);
  }

  /**
   * Buff 激活时的初始化（GAS 模式）
   * 子类重写此方法来订阅事件、添加标签、添加属性修改器等
   *
   * 注意：此方法在 setOwner() 之后调用，此时 this._owner 已可用
   */
  onActivate(): void {
    // 基类默认行为：无操作
    // 子类应重写此方法实现具体逻辑
  }

  /**
   * Buff 移除时的清理（GAS 模式）
   * 子类重写此方法来取消订阅、移除标签、移除属性修改器等
   */
  onDeactivate(): void {
    // 取消所有事件订阅
    this._unsubscribeAll();
    // 子类应重写此方法实现具体清理逻辑
  }

  /**
   * 订阅事件的辅助方法（存储 handler 引用用于后续取消订阅）
   */
  protected _subscribeEvent<T extends { type: string }>(
    eventType: string,
    handler: (event: T) => void,
    priority: number = 0
  ): void {
    // 包装 handler 以便存储
    const wrappedHandler = handler as (event: unknown) => void;
    this._subscribedHandlers.push({
      eventType,
      handler: wrappedHandler,
    });
    EventBus.instance.subscribe(eventType, wrappedHandler, priority);
  }

  /**
   * 取消订阅事件
   */
  protected _unsubscribeEvent(eventType: string): void {
    const remaining: Array<{
      eventType: string;
      handler: (event: unknown) => void;
    }> = [];

    for (const subscription of this._subscribedHandlers) {
      if (subscription.eventType === eventType) {
        EventBus.instance.unsubscribe(subscription.eventType, subscription.handler);
      } else {
        remaining.push(subscription);
      }
    }

    this._subscribedHandlers = remaining;
  }

  /**
   * 取消所有事件订阅
   */
  protected _unsubscribeAll(): void {
    for (const subscription of this._subscribedHandlers) {
      EventBus.instance.unsubscribe(subscription.eventType, subscription.handler);
    }
    this._subscribedHandlers = [];
  }

  /**
   * 持续时间管理
   */
  getDuration(): number {
    return this._duration;
  }

  getMaxDuration(): number {
    return this._maxDuration;
  }

  tickDuration(): void {
    if (!this.isPermanent()) {
      this._duration = Math.max(0, this._duration - 1);
    }
  }

  refreshDuration(): void {
    this._duration = this._maxDuration;
  }

  /**
   * 刷新持续时间到指定值（用于堆叠规则 REFRESH_DURATION）
   * @param duration 新的持续时间和最大持续时间
   */
  refreshToDuration(duration: number): void {
    this._duration = duration;
    this._maxDuration = duration;
  }

  /**
   * 设置持续时间（供子类 clone 使用）
   */
  protected setDuration(duration: number): void {
    this._duration = duration;
  }

  isPermanent(): boolean {
    return this._maxDuration === -1;
  }

  isExpired(): boolean {
    return !this.isPermanent() && this._duration <= 0;
  }

  /**
   * 属性修改器（可被子类重写）
   */
  getAttributeModifiers(): [] {
    return [];
  }

  /**
   * 克隆 Buff 实例
   * 子类可以重写此方法以实现更复杂的克隆逻辑
   * 注意：
   * - owner 和 source 不会被复制，需要通过 setOwner/setSource 设置
   * - 层数会被复制
   */
  clone(): Buff {
    const cloned = new Buff(
      this.id,
      this.name,
      this.type,
      this._maxDuration,
      this.stackRule
    );
    cloned.setDuration(this._duration);
    cloned.tags = this.tags.clone();
    cloned._layer = this._layer;
    // 注意：不复制 owner、source 和事件订阅，这些需要在 addBuff 时重新设置
    return cloned;
  }
}
