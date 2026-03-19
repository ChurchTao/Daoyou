// engine/battle-v5/abilities/PassiveAbility.ts

import { Ability } from './Ability';
import { AbilityId, AbilityType, CombatEvent } from '../core/types';
import { AbilityContext } from './Ability';

/**
 * 被动能力基类
 *
 * 特点：
 * - 无冷却、无消耗
 * - 通过事件触发（而非主动释放）
 * - 在激活时自动订阅事件
 *
 * 生命周期：
 * 1. 创建 → constructor()
 * 2. 绑定所有者 → setOwner()
 * 3. 激活 → setActive(true) → setupEventListeners()
 * 4. 触发 → 事件驱动，通过 createEventHandler 包装
 * 5. 停用 → setActive(false) → 自动取消订阅
 */
export abstract class PassiveAbility extends Ability {
  constructor(id: AbilityId, name: string) {
    super(id, name, AbilityType.PASSIVE_SKILL);
  }

  // ===== 生命周期 =====

  protected override onActivate(): void {
    super.onActivate();
    this.setupEventListeners();
  }

  /**
   * 子类实现：设置事件监听
   *
   * 示例：
   * ```ts
   * protected setupEventListeners(): void {
   *   this.subscribeEvent(
   *     'DamageTakenEvent',
   *     this.createEventHandler((e) => this.onDamageTaken(e))
   *   );
   * }
   * ```
   */
  protected abstract setupEventListeners(): void;

  // ===== 事件处理辅助 =====

  /**
   * 创建事件处理包装器
   * 自动检查所有者是否存活
   */
  protected createEventHandler<T extends CombatEvent>(
    handler: (event: T) => void
  ): (event: T) => void {
    return (event: T) => {
      const owner = this.getOwner();
      if (!owner || !owner.isAlive()) return;
      handler(event);
    };
  }

  // ===== 核心方法（被动技能通常不通过 execute 执行） =====

  /**
   * 被动技能永远可以触发（由事件驱动）
   */
  override canTrigger(_context: AbilityContext): boolean {
    return true;
  }

  /**
   * 被动技能通常不通过 execute 执行
   * 而是通过事件订阅直接响应
   */
  override execute(_context: AbilityContext): void {
    // 默认空实现
  }

  // ===== 克隆 =====

  override clone(): PassiveAbility {
    const cloned = super.clone() as PassiveAbility;
    return cloned;
  }
}
