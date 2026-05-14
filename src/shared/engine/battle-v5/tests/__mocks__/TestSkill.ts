import { ActiveSkill } from '../../abilities/ActiveSkill';
import { Unit } from '../../units/Unit';
import { AbilityId } from '../../core/types';

/**
 * 测试用的简单主动技能
 */
export class TestSkill extends ActiveSkill {
  constructor(id: AbilityId, name: string) {
    super(id, name, { mpCost: 0, cooldown: 0 });
  }

  protected executeSkill(_caster: Unit, _target: Unit): void {
    // 测试技能，不执行任何操作
  }
}
