import { ActiveSkill } from '../ActiveSkill';
import { AbilityId, AttributeType } from '../../core/types';
import { Unit } from '../../units/Unit';

/**
 * 火球术 - 示例主动技能
 * 消耗 30 MP，造成基于灵力的魔法伤害
 */
export class FireballSkill extends ActiveSkill {
  constructor() {
    super('fireball' as AbilityId, '火球术', 30, 3);
  }

  protected executeSkill(caster: Unit, target: Unit): void {
    // 基础伤害: 灵力 × 2
    const spirit = caster.attributes.getValue(AttributeType.SPIRIT);
    const baseDamage = spirit * 2;

    // 造成伤害
    target.takeDamage(baseDamage);
  }
}
