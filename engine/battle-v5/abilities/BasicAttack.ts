// engine/battle-v5/abilities/BasicAttack.ts
import { AbilityId } from '../core/types';
import { ActiveSkill } from './ActiveSkill';

/**
 * 普攻技能
 * 当没有可用技能时使用
 */
export class BasicAttack extends ActiveSkill {
  constructor() {
    super('basic_attack' as AbilityId, '普攻');
    this.setDamageCoefficient(1.0);
    this.setBaseDamage(20);
    this.setIsPhysicalAbility(true);
    this.setManaCost(0);
    this.setPriority(0);
  }

  /**
   * 普攻没有额外效果
   */
  executeSkill(caster: unknown, target: unknown): void {
    // 普攻的伤害计算由 DamageSystem 通过事件处理
    // 这里不需要额外逻辑
  }
}
