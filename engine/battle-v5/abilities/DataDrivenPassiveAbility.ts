import { PassiveAbility } from './PassiveAbility';
import { AbilityId, CombatEvent } from '../core/types';
import { GameplayEffect, EffectContext } from '../effects/Effect';
import {
  ListenerRuntimeConfig,
  resolveListenerContext,
  shouldExecuteListener,
} from '../core/listenerExecution';

/**
 * 数据驱动的被动能力 (Data-Driven Passive Ability)
 * 
 * 职责：
 * - 动态订阅战斗事件 (EDA)
 * - 当事件触发时，执行对应的原子效果链 (GAS)
 */
export class DataDrivenPassiveAbility extends PassiveAbility {
  /**
   * 为了支持工厂装配，我们内部持有已实例化的效果映射
   */
  private _instantiatedListeners: Array<{
    runtime: ListenerRuntimeConfig;
    effects: GameplayEffect[];
  }> = [];

  constructor(id: AbilityId, name: string) {
    super(id, name);
  }

  addInstantiatedListener(runtime: ListenerRuntimeConfig, effects: GameplayEffect[]): void {
    this._instantiatedListeners.push({ runtime, effects });
  }

  /**
   * 设置事件监听
   * 覆盖基类方法，实现动态订阅
   */
  protected override setupEventListeners(): void {
    for (const listener of this._instantiatedListeners) {
      // 订阅指定类型的事件
      this.subscribeEvent(
        listener.runtime.eventType,
        this.createEventHandler((event: CombatEvent) => {
          this._executeInstantiatedEffects(listener.runtime, listener.effects, event);
        }),
        listener.runtime.priority,
      );
    }
  }

  private _executeInstantiatedEffects(
    runtime: ListenerRuntimeConfig,
    effects: GameplayEffect[],
    event: CombatEvent,
  ): void {
    const owner = this.getOwner();
    if (!owner) return;

    if (!shouldExecuteListener(owner, event, runtime)) {
      return;
    }

    const resolved = resolveListenerContext(owner, event, runtime.mapping);

    const context: EffectContext = {
      caster: resolved.caster,
      target: resolved.target,
      ability: this,
      triggerEvent: event, // 关键：注入触发事件
    };

    for (const effect of effects) {
      effect.execute(context);
    }
  }

  /**
   * 被动技能没有主动效果链
   */
  protected setupListeners(): void {}

  override clone(): DataDrivenPassiveAbility {
    const cloned = new DataDrivenPassiveAbility(this.id, this.name);
    // 复制实例化后的监听器
    for (const listener of this._instantiatedListeners) {
      cloned.addInstantiatedListener(
        {
          ...listener.runtime,
          mapping: { ...listener.runtime.mapping },
          guard: { ...listener.runtime.guard },
        },
        [...listener.effects],
      );
    }
    return cloned;
  }
}
