import { BuffConfig } from '../core/configs';
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
    eventType: string;
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

  addInstantiatedListener(eventType: string, effects: GameplayEffect[]): void {
    this._instantiatedListeners.push({ eventType, effects });
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
        listener.eventType,
        (event) => this._executeEffects(listener.effects, event),
        45, // 默认使用 ROUND_PRE 优先级，后续可根据事件类型动态调整
      );
    }
  }

  private _executeEffects(effects: GameplayEffect[], event: CombatEvent): void {
    if (!this._owner || !this._owner.isAlive()) return;

    // 构建上下文：如果是受击事件，伤害归属者由事件决定
    const caster = this._source || this._owner;
    const target = this._owner; // Buff 效果通常作用于宿主

    const context: EffectContext = {
      caster,
      target,
      event,
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
      cloned.addInstantiatedListener(listener.eventType, [...listener.effects]);
    }

    return cloned;
  }
}
