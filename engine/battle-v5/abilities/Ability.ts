import { AbilityId, AbilityType, CombatEvent } from '../core/types';

export type { AbilityId };
import { Unit } from '../units/Unit';
import { EventBus } from '../core/EventBus';
import { GameplayTagContainer } from '../core/GameplayTags';

type EventHandler = (event: CombatEvent) => void;

/**
 * 能力上下文 - 传递给 canTrigger 和 execute 的参数
 */
export interface AbilityContext {
  caster: Unit;
  target: Unit;
  shouldApplyEffects?: boolean;
}

/**
 * Ability 基类 - 遵循 GAS 设计原则
 *
 * 职责：
 * - 定义能力的核心接口（canTrigger, execute）
 * - 管理标签系统（用于条件判断和解耦）
 * - 提供事件订阅辅助方法
 *
 * 生命周期：
 * 1. 创建 → constructor()
 * 2. 绑定所有者 → setOwner()
 * 3. 激活 → setActive(true) → 调用 onActivate()
 * 4. 执行 → canTrigger() 检查 → execute() 执行
 * 5. 停用 → setActive(false) → 调用 onDeactivate()
 * 6. 销毁 → destroy()
 *
 * 子类职责：
 * - ActiveSkill: 添加冷却、消耗、目标策略
 * - PassiveAbility: 订阅事件，响应触发
 */
export class Ability {
  readonly id: AbilityId;
  readonly name: string;
  readonly type: AbilityType;

  // 核心属性
  private _owner: Unit | null = null;
  private _active: boolean = false;
  private _priority: number = 0;  // 执行优先级（数值越大越优先）

  // 标签容器
  readonly tags: GameplayTagContainer;

  // 事件订阅管理
  private _eventSubscriptions: Array<{
    eventType: string;
    handler: EventHandler;
  }> = [];

  constructor(id: AbilityId, name: string, type: AbilityType) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.tags = new GameplayTagContainer();
  }

  // ===== 所有者管理 =====

  setOwner(owner: Unit): void {
    this._owner = owner;
  }

  getOwner(): Unit | null {
    return this._owner;
  }

  // ===== 激活状态管理 =====

  setActive(active: boolean): void {
    if (this._active === active) return;

    this._active = active;

    if (active) {
      this.onActivate();
    } else {
      this.onDeactivate();
    }
  }

  isActive(): boolean {
    return this._active;
  }

  // ===== 生命周期钩子（子类可重写） =====

  /**
   * 激活时调用
   * 子类可重写此方法进行初始化（如订阅事件）
   */
  protected onActivate(): void {
    // 默认空实现，子类可重写
  }

  /**
   * 停用时调用
   * 子类可重写此方法进行清理（如取消订阅）
   * 注意：基类会自动取消所有通过 subscribeEvent 订阅的事件
   */
  protected onDeactivate(): void {
    // 自动取消所有事件订阅
    for (const subscription of this._eventSubscriptions) {
      EventBus.instance.unsubscribe(subscription.eventType, subscription.handler);
    }
    this._eventSubscriptions = [];
  }

  // ===== 事件订阅辅助 =====

  /**
   * 订阅事件（会在停用时自动取消）
   */
  protected subscribeEvent(
    eventType: string,
    handler: EventHandler,
    priority?: number
  ): void {
    EventBus.instance.subscribe(eventType, handler, priority);
    this._eventSubscriptions.push({ eventType, handler });
  }

  // ===== 核心方法（子类必须实现或重写） =====

  /**
   * 检查是否可以触发
   * @param context 包含 caster 和 target 的上下文
   * @returns 是否可以执行
   */
  canTrigger(context: AbilityContext): boolean {
    const owner = this._owner ?? context.caster;
    if (!owner) return false;
    return true;
  }

  /**
   * 执行能力效果
   * @param context 包含 caster 和 target 的上下文
   */
  execute(_context: AbilityContext): void {
    void _context;
    // 基类空实现，子类重写
  }

  // ===== 优先级 =====

  get priority(): number {
    return this._priority;
  }

  setPriority(value: number): void {
    this._priority = value;
  }

  // ===== 克隆 =====

  /**
   * 克隆能力实例
   * 注意：不复制 owner 和 active 状态
   */
  clone(): Ability {
    const cloned = new Ability(this.id, this.name, this.type);
    cloned._priority = this._priority;
    cloned.tags.addTags(this.tags.getTags());
    return cloned;
  }

  // ===== 销毁 =====

  /**
   * 销毁能力，释放资源
   */
  destroy(): void {
    this.setActive(false);
    this._owner = null;
  }
}
