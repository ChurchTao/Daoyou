import { GameplayEffect, EffectContext } from './Effect';
import { DamageRequestEvent, DamageTakenEvent } from '../core/events';
import { EventBus } from '../core/EventBus';
import { EffectRegistry } from '../factories/EffectRegistry';
import { ReflectParams } from '../core/configs';
import { DamageSource } from '../core';
import { claimActionAmount } from '../core/runtimeState';

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

    // 二次伤害不再触发反伤，避免反伤、反击、追击之间形成闭环。
    if (
      damageTakenEvent.damageSource === DamageSource.REFLECT ||
      damageTakenEvent.damageSource === DamageSource.COUNTER ||
      damageTakenEvent.damageSource === DamageSource.FOLLOW_UP ||
      damageTakenEvent.damageSource === DamageSource.DELAYED
    ) {
      return;
    }

    const layer = this.params.layerBuffId
      ? target.buffs.getAllBuffs().find((buff) => buff.id === this.params.layerBuffId)?.getLayer() ?? 0
      : 0;
    const raw = Math.round(
      damageTakenEvent.damageTaken *
        (this.params.ratio + layer * (this.params.ratioPerLayer ?? 0)),
    );
    const attacker = damageTakenEvent.caster;
    const damageToReflect = this.params.maxHpRatioPerAction
      ? claimActionAmount(
          attacker ?? target,
          `reflect:${target.id}:${this.params.layerBuffId ?? 'generic'}`,
          raw,
          Math.round(target.getMaxHp() * this.params.maxHpRatioPerAction),
        )
      : raw;

    if (damageToReflect <= 0) return;

    // 给攻击者发送伤害请求
    if (attacker && attacker.isAlive()) {
      EventBus.instance.publish<DamageRequestEvent>({
        type: 'DamageRequestEvent',
        timestamp: Date.now(),
        caster: target,
        target: attacker,
        damageSource: DamageSource.REFLECT,
        damageType: damageTakenEvent.damageType, // 反伤的伤害类型与原伤害相同
        baseDamage: damageToReflect,
        finalDamage: damageToReflect,
      });
    }
  }
}

// 注册
EffectRegistry.getInstance().register('reflect', (params) => new ReflectEffect(params));
