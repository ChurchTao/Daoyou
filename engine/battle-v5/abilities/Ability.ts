import { AbilityId, AbilityType, CombatEvent } from '../core/types';

export type { AbilityId };
import { Unit } from '../units/Unit';
import { EventBus } from '../core/EventBus';
import { GameplayTagContainer } from '../core/GameplayTags';

type EventHandler = (event: CombatEvent) => void;

/**
 * 能力基类
 * 所有技能、命格、被动能力的基类
 */
export class Ability {
  readonly id: AbilityId;
  readonly name: string;
  readonly type: AbilityType;
  private _active: boolean = false;
  private _owner: Unit | null = null;
  private _cooldown: number = 0;
  private _maxCooldown: number = 0;
  private _eventHandlers: Map<string, EventHandler> = new Map();

  // Extended properties for damage and trigger validation
  private _damageCoefficient: number = 1.0;
  private _baseDamage: number = 0;
  private _priority: number = 0;
  private _manaCost: number = 0;

  // 标签容器
  readonly tags: GameplayTagContainer;

  // Public hooks for testing
  public onActivate: () => void = () => {};
  public onDeactivate: () => void = () => {};

  constructor(id: AbilityId, name: string, type: AbilityType) {
    this.id = id;
    this.name = name;
    this.type = type;

    // 初始化标签容器
    this.tags = new GameplayTagContainer();
  }

  setOwner(owner: Unit): void {
    this._owner = owner;
  }

  getOwner(): Unit | null {
    return this._owner;
  }

  setActive(active: boolean): void {
    if (this._active === active) return;

    this._active = active;

    if (active) {
      this.protectedOnActivate();
    } else {
      this.protectedOnDeactivate();
    }
  }

  isActive(): boolean {
    return this._active;
  }

  /**
   * 能力激活时调用
   * 子类可以订阅事件
   */
  protected protectedOnActivate(): void {
    this.onActivate();
  }

  /**
   * 能力停用时调用
   * 子类应该取消订阅事件
   */
  protected protectedOnDeactivate(): void {
    // 取消所有事件订阅
    const eventTypes = Array.from(this._eventHandlers.keys());
    for (const eventType of eventTypes) {
      const handler = this._eventHandlers.get(eventType);
      if (handler) {
        EventBus.instance.unsubscribe(eventType, handler);
      }
    }
    this._eventHandlers.clear();
    this.onDeactivate();
  }

  /**
   * 订阅事件（辅助方法）
   */
  protected subscribeEvent(eventType: string, handler: EventHandler, priority?: number): void {
    EventBus.instance.subscribe(eventType, handler, priority);
    this._eventHandlers.set(eventType, handler);
  }

  /**
   * 检查是否可以触发
   * 子类可以重写此方法实现自定义条件
   */
  canTrigger(context: { caster: Unit; target: Unit }): boolean {
    if (!this.isReady()) return false;

    const caster = this._owner;
    if (!caster) return false;

    // Check if caster has enough mana
    if (caster.currentMp < this._manaCost) return false;

    return true;
  }

  /**
   * 执行能力效果
   * 子类必须实现此方法
   */
  execute(context: { caster: Unit; target: Unit }): void {
    // 子类实现
  }

  /**
   * 冷却管理
   */
  setCooldown(cooldown: number): void {
    this._maxCooldown = cooldown;
  }

  startCooldown(): void {
    this._cooldown = this._maxCooldown;
  }

  getCurrentCooldown(): number {
    return this._cooldown;
  }

  tickCooldown(): void {
    if (this._cooldown > 0) {
      this._cooldown--;
    }
  }

  isReady(): boolean {
    return this._cooldown === 0;
  }

  resetCooldown(): void {
    this._cooldown = 0;
  }

  // Extended property getters and setters

  get damageCoefficient(): number {
    return this._damageCoefficient;
  }

  setDamageCoefficient(value: number): void {
    this._damageCoefficient = value;
  }

  get baseDamage(): number {
    return this._baseDamage;
  }

  setBaseDamage(value: number): void {
    this._baseDamage = value;
  }

  get priority(): number {
    return this._priority;
  }

  setPriority(value: number): void {
    this._priority = value;
  }

  get manaCost(): number {
    return this._manaCost;
  }

  setManaCost(value: number): void {
    this._manaCost = value;
  }
}
