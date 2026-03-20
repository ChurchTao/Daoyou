import { PassiveAbility } from './PassiveAbility';
import { AbilityId, CombatEvent } from '../core/types';
import { AbilityContext } from './Ability';
import { GameplayEffect, EffectContext } from '../effects/Effect';
import { EventBus } from '../core/EventBus';
import { ListenerConfig } from '../core/configs';

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
    eventType: string;
    effects: GameplayEffect[];
  }> = [];

  constructor(id: AbilityId, name: string) {
    super(id, name);
  }

  addInstantiatedListener(eventType: string, effects: GameplayEffect[]): void {
    this._instantiatedListeners.push({ eventType, effects });
  }

  /**
   * 设置事件监听
   * 覆盖基类方法，实现动态订阅
   */
  protected override setupEventListeners(): void {
    for (const listener of this._instantiatedListeners) {
      // 订阅指定类型的事件
      this.subscribeEvent(
        listener.eventType,
        this.createEventHandler((event: CombatEvent) => {
          this._executeInstantiatedEffects(listener.effects, event);
        })
      );
    }
  }

  private _executeInstantiatedEffects(effects: GameplayEffect[], event: CombatEvent): void {
    const owner = this.getOwner();
    if (!owner) return;

    // --- 动态上下文转换逻辑 ---
    // 被动技能的触发源和目标往往具有特殊语义
    
    let caster = owner; // 默认施法者是拥有被动技能的单位
    let target = owner; // 默认目标是自己

    // 特殊事件语义处理
    if (event.type === 'DamageTakenEvent') {
      const e = event as any;
      // 如果我是受击者 (target)，那么我的反击目标应该是攻击者 (caster)
      if (e.target?.id === owner.id) {
        target = e.caster || owner;
      }
    } else if (event.type === 'RoundPreEvent' || event.type === 'RoundPostEvent') {
      target = owner;
    }

    const context: EffectContext = {
      caster,
      target,
      ability: this,
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
      cloned.addInstantiatedListener(listener.eventType, [...listener.effects]);
    }
    return cloned;
  }
}
