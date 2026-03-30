// engine/battle-v5/abilities/BasicAttack.ts
import { GameplayTags } from '../core/GameplayTags';
import { AbilityId, AttributeType } from '../core/types';
import { DamageEffect } from '../effects/DamageEffect';
import { Unit } from '../units/Unit';
import { ActiveSkill } from './ActiveSkill';

/**
 * 普攻技能
 * 当没有可用技能时使用
 */
export class BasicAttack extends ActiveSkill {
  private _damageEffect: DamageEffect;

  constructor() {
    super('basic_attack' as AbilityId, '普攻', {
      mpCost: 0,
      cooldown: 0,
      priority: 0,
    });

    // 普攻效果：1.0 倍体魄伤害 + 20 基础伤害
    this._damageEffect = new DamageEffect({
      value: {
        attribute: AttributeType.VITALITY,
        base: 100,
      },
    });

    this.tags.addTags([GameplayTags.ABILITY.TYPE_PHYSICAL]);
  }

  /**
   * 执行普攻
   */
  protected executeSkill(caster: Unit, target: Unit): void {
    this._damageEffect.execute({
      caster,
      target,
      ability: this,
    });
  }
}
