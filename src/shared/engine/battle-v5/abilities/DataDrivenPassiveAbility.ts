import { PassiveAbility } from './PassiveAbility';
import { AbilityId, AttributeModifier, CombatEvent } from '../core/types';
import { AttributeModifierConfig, GlobalUniqueConfig } from '../core/configs';
import {
  claimGlobalUniqueEffect,
  releaseGlobalUniqueEffects,
} from '../core/runtimeState';
import {
  GameplayEffect,
  EffectExecutionContextV3,
  executeGameplayEffectV3,
} from '../effects/Effect';
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
    effects: InstantiatedGameplayEffect[];
  }> = [];
  private _modifiers: AttributeModifierConfig[] = [];

  constructor(id: AbilityId, name: string) {
    super(id, name);
  }

  addInstantiatedListener(
    runtime: ListenerRuntimeConfig,
    effects: InstantiatedGameplayEffect[],
  ): void {
    this._instantiatedListeners.push({ runtime, effects });
  }

  addModifier(config: AttributeModifierConfig): void {
    this._modifiers.push(config);
  }

  protected override onActivate(): void {
    const owner = this.getOwner();

    if (owner) {
      for (const [index, modifier] of this._modifiers.entries()) {
        const mountedModifier: AttributeModifier = {
          id: `${this.id}_${modifier.attrType}_${index}`,
          attrType: modifier.attrType,
          type: modifier.type,
          value: modifier.value,
          source: this,
        };
        owner.attributes.addModifier(mountedModifier);
      }
      owner.updateDerivedStats();
    }

    super.onActivate();
  }

  protected override onDeactivate(): void {
    const owner = this.getOwner();
    if (owner) {
      owner.attributes.removeModifierBySource(this);
      owner.updateDerivedStats();
    }

    super.onDeactivate();
    if (owner) {
      releaseGlobalUniqueEffects(owner, this);
    }
  }

  /**
   * 设置事件监听
   * 覆盖基类方法，实现动态订阅
   */
  protected override setupEventListeners(): void {
    const owner = this.getOwner();
    if (!owner) return;

    for (const listener of this._instantiatedListeners) {
      const mountedEffects = listener.effects.filter((entry) => {
        const key = entry.globalUnique?.key;
        return !key || claimGlobalUniqueEffect(owner, key, this);
      });
      if (mountedEffects.length === 0) {
        continue;
      }

      // 订阅指定类型的事件
      this.subscribeEvent(
        listener.runtime.eventType,
        this.createEventHandler((event: CombatEvent) => {
          this._executeInstantiatedEffects(listener.runtime, mountedEffects, event);
        }),
        listener.runtime.priority,
      );
    }
  }

  private _executeInstantiatedEffects(
    runtime: ListenerRuntimeConfig,
    effects: InstantiatedGameplayEffect[],
    event: CombatEvent,
  ): void {
    const owner = this.getOwner();
    if (!owner) return;

    if (!shouldExecuteListener(owner, event, runtime, this)) {
      return;
    }

    const resolved = resolveListenerContext(owner, event, runtime.mapping);

    const context = EffectExecutionContextV3.passiveAbility({
      owner,
      caster: resolved.caster,
      target: resolved.target,
      ability: this,
      triggerEvent: event, // 关键：注入触发事件
      resolution: event.resolution,
    });

    for (const { effect } of effects) {
      executeGameplayEffectV3(effect, context);
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
          triggerPolicy: listener.runtime.triggerPolicy
            ? { ...listener.runtime.triggerPolicy }
            : undefined,
          conditions: listener.runtime.conditions?.map((condition) => ({
            ...condition,
            params: { ...condition.params },
          })),
        },
        [...listener.effects],
      );
    }
    for (const modifier of this._modifiers) {
      cloned.addModifier({ ...modifier });
    }
    return cloned;
  }
}

export interface InstantiatedGameplayEffect {
  effect: GameplayEffect;
  globalUnique?: GlobalUniqueConfig;
}
