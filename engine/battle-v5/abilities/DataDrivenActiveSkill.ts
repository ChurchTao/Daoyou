import { ActiveSkill, ActiveSkillConfig } from './ActiveSkill';
import { GameplayEffect, EffectContext } from '../effects/Effect';
import { AbilityId, CombatEvent } from '../core/types';
import {
  ListenerRuntimeConfig,
  resolveListenerContext,
  shouldExecuteListener,
} from '../core/listenerExecution';
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
  private _instantiatedListeners: Array<{
    runtime: ListenerRuntimeConfig;
    effects: GameplayEffect[];
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

  addInstantiatedListener(
    runtime: ListenerRuntimeConfig,
    effects: GameplayEffect[],
  ): void {
    this._instantiatedListeners.push({ runtime, effects });
  }

  protected override onActivate(): void {
    super.onActivate();

    for (const listener of this._instantiatedListeners) {
      this.subscribeEvent(
        listener.runtime.eventType,
        (event: CombatEvent) => {
          this._executeInstantiatedEffects(
            listener.runtime,
            listener.effects,
            event,
          );
        },
        listener.runtime.priority,
      );
    }
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
    };

    // 依次执行效果链
    for (const effect of this._effects) {
      effect.execute(context);
    }
  }

  private _executeInstantiatedEffects(
    runtime: ListenerRuntimeConfig,
    effects: GameplayEffect[],
    event: CombatEvent,
  ): void {
    const owner = this.getOwner();
    if (!owner) {
      return;
    }

    const eventAbility = (event as CombatEvent & { ability?: { id?: string } })
      .ability;
    if (eventAbility && eventAbility.id !== this.id) {
      return;
    }

    if (!shouldExecuteListener(owner, event, runtime)) {
      return;
    }

    const resolved = resolveListenerContext(owner, event, runtime.mapping);
    const context: EffectContext = {
      caster: resolved.caster,
      target: resolved.target,
      ability: this,
      triggerEvent: event,
    };

    for (const effect of effects) {
      effect.execute(context);
    }
  }

  /**
   * 克隆技能实例，同时克隆所有效果
   */
  override clone(): DataDrivenActiveSkill {
    const cloned = super.clone() as DataDrivenActiveSkill;
    // 注意：这里的效果链不需要特殊处理，因为它们是无状态的单例或由工厂动态创建
    // 如果效果有状态，则需要深度克隆
    cloned._effects = [...this._effects];
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
