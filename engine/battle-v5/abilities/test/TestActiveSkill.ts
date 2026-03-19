import { ActiveSkill } from '../ActiveSkill';
import { AbilityType } from '../../core/types';
import { GameplayTags } from '../../core/GameplayTags';
import { Unit } from '../../units/Unit';

/**
 * Test active skill for integration testing
 * A simple damage-dealing skill
 */
export class TestActiveSkill extends ActiveSkill {
  constructor(id: string, name: string) {
    super(id as any, name, {
      mpCost: 10,
      cooldown: 0,
      priority: 10,
    });
    this.setDamageCoefficient(1.5);
    this.setBaseDamage(30);
    this.tags.addTags([GameplayTags.ABILITY.TYPE_MAGIC]);
  }

  protected executeSkill(_caster: Unit, _target: Unit): void {
    // The actual damage is handled by the DamageSystem via events
    // This is just a placeholder for the skill effect
    // In the event-driven architecture, SkillCastEvent triggers DamageSystem
  }
}
