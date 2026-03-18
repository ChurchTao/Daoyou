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
    super(id, name, 0, 0); // mpCost, cooldown
    this.setDamageCoefficient(1.5);
    this.setBaseDamage(30);
    this.tags.addTags([GameplayTags.ABILITY.TYPE_MAGIC]);
    this.setManaCost(10);
    this.setPriority(10);
  }

  protected executeSkill(caster: Unit, target: Unit): void {
    // The actual damage is handled by the DamageSystem via events
    // This is just a placeholder for the skill effect
    // In the event-driven architecture, SkillCastEvent triggers DamageSystem
  }
}
