// engine/battle-v5/abilities/BasicAttack.ts
import { AbilityId } from '../core/types';
import { GameplayTags } from '../core/GameplayTags';
import { ActiveSkill } from './ActiveSkill';
import { Unit } from '../units/Unit';

/**
 * 普攻技能
 * 当没有可用技能时使用
 */
export class BasicAttack extends ActiveSkill {
  constructor() {
    super('basic_attack' as AbilityId, '普攻', {
      mpCost: 0,
      cooldown: 0,
      priority: 0,
    });
    this.setDamageCoefficient(1.0);
    this.setBaseDamage(20);
    this.tags.addTags([GameplayTags.ABILITY.TYPE_PHYSICAL]);
  }

  /**
   * 普攻没有额外效果
   */
  protected executeSkill(_caster: Unit, _target: Unit): void {
    // 普攻的伤害计算由 DamageSystem 通过事件处理
    // 这里不需要额外逻辑
  }
}
