import { ActiveSkill, ActiveSkillConfig } from './ActiveSkill';
import { GlobalUniqueConfig } from '../core/configs';
import { GameplayEffect, EffectContext } from '../effects/Effect';
import { AbilityId, CombatEvent } from '../core/types';
import {
  ListenerRuntimeConfig,
  resolveListenerContext,
  shouldExecuteListener,
} from '../core/listenerExecution';
import {
  claimGlobalUniqueEffect,
  releaseGlobalUniqueEffects,
} from '../core/runtimeState';
import { Unit } from '../units/Unit';

/**
 * 数据驱动的主动技能 (Data-Driven Active Skill)
 * 
 * 职责：
 * - 作为原子效果 (GameplayEffect) 的容器
 * - 按照顺序执行所有原子效果
 * - 遵循 GAS 规范进行资源消耗和冷却管理
 */
export class DataDrivenActiveSkill extends ActiveSkill {
  private _effects: GameplayEffect[] = [];
  private _castEffects: GameplayEffect[] = [];
  private _instantiatedListeners: Array<{
    runtime: ListenerRuntimeConfig;
    effects: InstantiatedGameplayEffect[];
  }> = [];

  constructor(id: AbilityId, name: string, config: ActiveSkillConfig = {}) {
    super(id, name, config);
  }

  /**
   * 向技能添加一个原子效果
   * @param effect 原子效果实例
   */
  addEffect(effect: GameplayEffect): void {
    this._effects.push(effect);
  }

  addCastEffect(effect: GameplayEffect): void {
    this._castEffects.push(effect);
  }

  addInstantiatedListener(
    runtime: ListenerRuntimeConfig,
    effects: InstantiatedGameplayEffect[],
  ): void {
    this._instantiatedListeners.push({ runtime, effects });
  }

  protected override onActivate(): void {
    super.onActivate();
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

      this.subscribeEvent(
        listener.runtime.eventType,
        (event: CombatEvent) => {
          this._executeInstantiatedEffects(
            listener.runtime,
            mountedEffects,
            event,
          );
        },
        listener.runtime.priority,
      );
    }
  }

  protected override onDeactivate(): void {
    const owner = this.getOwner();
    if (owner) {
      releaseGlobalUniqueEffects(owner, this);
    }
    super.onDeactivate();
  }

  /**
   * 执行技能核心逻辑
   * 依次触发所有装配的效果
   */
  protected executeSkill(caster: Unit, target: Unit): void {
    const context: EffectContext = {
      caster,
      target,
      ability: this,
      castSnapshot: this.castSnapshot,
    };

    // 依次执行效果链
    for (const effect of this._effects) {
      effect.execute(context);
    }
  }

  protected override executeCastEffects(caster: Unit, target: Unit): void {
    const context: EffectContext = {
      caster,
      target,
      ability: this,
      castSnapshot: this.castSnapshot,
    };
    for (const effect of this._castEffects) {
      effect.execute(context);
    }
  }

  private _executeInstantiatedEffects(
    runtime: ListenerRuntimeConfig,
    effects: InstantiatedGameplayEffect[],
    event: CombatEvent,
  ): void {
    const owner = this.getOwner();
    if (!owner) {
      return;
    }

    const eventAbility = (event as CombatEvent & { ability?: { id?: string } })
      .ability;
    if (eventAbility && eventAbility !== this) {
      return;
    }

    if (!shouldExecuteListener(owner, event, runtime, this)) {
      return;
    }

    const resolved = resolveListenerContext(owner, event, runtime.mapping);
    const context: EffectContext = {
      caster: resolved.caster,
      target: resolved.target,
      ability: this,
      triggerEvent: event,
    };

    for (const { effect } of effects) {
      effect.execute(context);
    }
  }

  /**
   * 克隆技能实例，同时克隆所有效果
   */
  override clone(): DataDrivenActiveSkill {
    const cloned = new DataDrivenActiveSkill(this.id, this.name, {
      description: this.description,
      costs: this.costConfigs,
      cooldown: this.maxCooldown,
      priority: this.priority,
      targetPolicy: this.targetPolicy,
      selectionProfile: this.selectionProfile,
      castConditions: this.castConditions,
      hitPolicy: this.hitPolicy,
    });
    cloned.tags.addTags(this.tags.getTags());
    if (this.currentCooldown > 0) cloned.modifyCooldown(this.currentCooldown);
    cloned._effects = [...this._effects];
    cloned._castEffects = [...this._castEffects];
    for (const listener of this._instantiatedListeners) {
      cloned.addInstantiatedListener(
        {
          ...listener.runtime,
          mapping: { ...listener.runtime.mapping },
          guard: { ...listener.runtime.guard },
          budget: listener.runtime.budget
            ? { ...listener.runtime.budget }
            : undefined,
          conditions: listener.runtime.conditions?.map((condition) => ({
            ...condition,
            params: { ...condition.params },
          })),
        },
        [...listener.effects],
      );
    }
    return cloned;
  }
}

export interface InstantiatedGameplayEffect {
  effect: GameplayEffect;
  globalUnique?: GlobalUniqueConfig;
}
