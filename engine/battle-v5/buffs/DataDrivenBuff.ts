import { BuffConfig } from '../core/configs';
import { BuffId, CombatEvent } from '../core/types';
import { EffectContext, GameplayEffect } from '../effects/Effect';
import {
  ListenerRuntimeConfig,
  resolveListenerContext,
  shouldExecuteListener,
} from '../core/listenerExecution';
import { Buff } from './Buff';

/**
 * 数据驱动的 BUFF (Data-Driven Buff)
 *
 * 职责：
 * - 完全基于配置定义行为
 * - 管理属性修改器和标签的生命周期
 * - 通过监听战斗事件执行原子效果
 */
export class DataDrivenBuff extends Buff {
  private _config: BuffConfig;
  private _instantiatedListeners: Array<{
    runtime: ListenerRuntimeConfig;
    effects: GameplayEffect[];
  }> = [];

  constructor(config: BuffConfig) {
    super(
      config.id as BuffId,
      config.name,
      config.type,
      config.duration,
      config.stackRule,
    );
    this._config = config;
  }

  addInstantiatedListener(runtime: ListenerRuntimeConfig, effects: GameplayEffect[]): void {
    this._instantiatedListeners.push({ runtime, effects });
  }

  override onActivate(): void {
    super.onActivate();
    if (!this._owner) return;

    // 1. 应用宿主标签
    if (this._config.statusTags) {
      this._owner.tags.addTags(this._config.statusTags);
    }

    // 2. 应用属性修改器
    if (this._config.modifiers) {
      for (const mod of this._config.modifiers) {
        this._owner.attributes.addModifier({
          id: `${this.id}_${mod.attrType}_${Math.random().toString(36).substr(2, 5)}`,
          attrType: mod.attrType,
          type: mod.type,
          value: mod.value,
          source: this,
        });
      }
    }

    // 3. 订阅动态事件
    this._setupEventListeners();
  }

  private _setupEventListeners(): void {
    for (const listener of this._instantiatedListeners) {
      this._subscribeEvent<CombatEvent>(
        listener.runtime.eventType,
        (event) => this._executeEffects(listener.runtime, listener.effects, event),
        listener.runtime.priority,
      );
    }
  }

  private _executeEffects(
    runtime: ListenerRuntimeConfig,
    effects: GameplayEffect[],
    event: CombatEvent,
  ): void {
    if (!this._owner) return; // 仅检查是否存在，不检查存活，以便处理免死逻辑

    if (!shouldExecuteListener(this._owner, event, runtime)) {
      return;
    }

    const resolved = resolveListenerContext(this._owner, event, runtime.mapping);

    const context: EffectContext = {
      caster: resolved.caster,
      target: resolved.target,
      triggerEvent: event, // 关键：注入触发事件
      buff: this,
    };

    for (const effect of effects) {
      effect.execute(context);
    }
  }

  override onDeactivate(): void {
    if (this._owner) {
      // 1. 移除宿主标签
      if (this._config.statusTags) {
        this._owner.tags.removeTags(this._config.statusTags);
      }

      // 2. 移除属性修改器 (通过 source 批量移除)
      this._owner.attributes.removeModifierBySource(this);
    }

    super.onDeactivate();
  }

  override clone(): DataDrivenBuff {
    const cloned = new DataDrivenBuff(this._config);
    cloned.tags = this.tags.clone();
    cloned.setSource(this._source);

    // 复制已实例化的效果
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
