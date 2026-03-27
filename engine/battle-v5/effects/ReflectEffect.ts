import { GameplayEffect, EffectContext } from './Effect';
import { DamageRequestEvent, DamageTakenEvent, EventPriorityLevel } from '../core/events';
import { EventBus } from '../core/EventBus';
import { EffectRegistry } from '../factories/EffectRegistry';
import { ReflectParams } from '../core/configs';

/**
 * 反伤原子效果
 * 订阅受击事件并在造成伤害后反馈给攻击者
 */
export class ReflectEffect extends GameplayEffect {
  constructor(private params: ReflectParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { triggerEvent, target } = context;

    // 需要感知受击伤害
    if (!triggerEvent || triggerEvent.type !== 'DamageTakenEvent') {
      return;
    }

    const damageTakenEvent = triggerEvent as DamageTakenEvent;

    // 反伤不应再次触发反伤，否则双方都有反伤时会形成链式回弹。
    if (damageTakenEvent.damageSource === 'reflect') {
      return;
    }

    const damageToReflect = Math.round(damageTakenEvent.damageTaken * this.params.ratio);

    if (damageToReflect <= 0) return;

    // 给攻击者发送伤害请求
    const attacker = damageTakenEvent.caster;
    if (attacker && attacker.isAlive()) {
      EventBus.instance.publish<DamageRequestEvent>({
        type: 'DamageRequestEvent',
        priority: EventPriorityLevel.DAMAGE_REQUEST,
        timestamp: Date.now(),
        caster: target,
        target: attacker,
        damageSource: 'reflect',
        baseDamage: damageToReflect,
        finalDamage: damageToReflect,
      });
    }
  }
}

// 注册
EffectRegistry.getInstance().register('reflect', (params) => new ReflectEffect(params));
