import { BuffConfig, GlobalUniqueConfig } from '../core/configs';
import {
  ListenerRuntimeConfig,
  resolveListenerContext,
  shouldExecuteListener,
} from '../core/listenerExecution';
import {
  claimGlobalUniqueEffect,
  releaseGlobalUniqueEffects,
} from '../core/runtimeState';
import { BuffId, CombatEvent } from '../core/types';
import { EffectContext, GameplayEffect } from '../effects/Effect';
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
    effects: InstantiatedGameplayEffect[];
  }> = [];

  constructor(config: BuffConfig) {
    super(
      config.id as BuffId,
      config.name,
      config.type,
      config.duration,
      config.stackRule,
      config.description,
      config.maxLayers,
      config.logVisibility,
      config.dispelPolicy,
    );
    this._config = config;
  }

  getConfig(): BuffConfig {
    return this._config;
  }

  addInstantiatedListener(
    runtime: ListenerRuntimeConfig,
    effects: InstantiatedGameplayEffect[],
  ): void {
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
    this._mountAttributeModifiers();

    // 3. 订阅动态事件
    this._setupEventListeners();
  }

  override onLayerChanged(): void {
    if (!this._owner) return;
    for (const [index, modifier] of (this._config.modifiers ?? []).entries()) {
      if (!modifier.scaleByLayer) continue;
      this._owner.attributes.removeModifier(this._attributeModifierId(index));
      this._mountAttributeModifier(index);
    }
    this._owner.updateDerivedStats();
  }

  private _mountAttributeModifiers(): void {
    if (!this._owner || !this._config.modifiers) return;
    for (const [index] of this._config.modifiers.entries()) {
      this._mountAttributeModifier(index);
    }
  }

  private _mountAttributeModifier(index: number): void {
    if (!this._owner) return;
    const modifier = this._config.modifiers?.[index];
    if (!modifier) return;
    this._owner.attributes.addModifier({
      id: this._attributeModifierId(index),
      attrType: modifier.attrType,
      type: modifier.type,
      value: modifier.value * (modifier.scaleByLayer ? this.getLayer() : 1),
      source: this,
    });
  }

  private _attributeModifierId(index: number): string {
    return `${this.id}:modifier:${index}`;
  }

  private _setupEventListeners(): void {
    if (!this._owner) return;

    for (const listener of this._instantiatedListeners) {
      const mountedEffects = listener.effects.filter((entry) => {
        const key = entry.globalUnique?.key;
        return !key || claimGlobalUniqueEffect(this._owner!, key, this);
      });
      if (mountedEffects.length === 0) {
        continue;
      }

      this._subscribeEvent<CombatEvent>(
        listener.runtime.eventType,
        (event) =>
          this._executeEffects(listener.runtime, mountedEffects, event),
        listener.runtime.priority,
      );
    }
  }

  private _executeEffects(
    runtime: ListenerRuntimeConfig,
    effects: InstantiatedGameplayEffect[],
    event: CombatEvent,
  ): void {
    if (!this._owner) return; // 仅检查是否存在，不检查存活，以便处理免死逻辑

    if (!shouldExecuteListener(this._owner, event, runtime, this)) {
      return;
    }

    const resolved = resolveListenerContext(
      this._owner,
      event,
      runtime.mapping,
    );

    const context: EffectContext = {
      caster: resolved.caster,
      target: resolved.target,
      triggerEvent: event, // 关键：注入触发事件
      buff: this,
    };

    for (const { effect } of effects) {
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
      releaseGlobalUniqueEffects(this._owner, this);
    }

    super.onDeactivate();
  }

  override clone(): DataDrivenBuff {
    const cloned = new DataDrivenBuff(this._config);
    cloned.tags = this.tags.clone();
    cloned.setSource(this._source);
    cloned.setDuration(this.getDuration());
    cloned.setLayer(this.getLayer());

    // 复制已实例化的效果
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
