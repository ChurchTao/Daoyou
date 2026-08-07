import { ActiveSkill } from '../abilities/ActiveSkill';
import { AbilityLockParams } from '../core/configs';
import { CooldownModifyEvent } from '../core/events';
import { EffectRegistry } from '../factories/EffectRegistry';
import { CombatMechanicCodeV3 } from '../v3/mechanics';
import { EffectExecutionContextV3, GameplayEffect } from './Effect';

export class AbilityLockEffect extends GameplayEffect {
  constructor(private params: AbilityLockParams) {
    super();
  }

  execute(context: EffectExecutionContextV3): void {
    const rounds = Math.max(1, Math.round(this.params.rounds));
    const matchedSkills = context.target.abilities
      .getAllAbilities()
      .filter(
        (ability): ability is ActiveSkill =>
          ability instanceof ActiveSkill &&
          ability !== context.ability &&
          (!this.params.tags || ability.tags.hasAnyTag(this.params.tags)),
      )
      .sort((a, b) => {
        const maxCooldownDiff = b.maxCooldown - a.maxCooldown;
        if (maxCooldownDiff !== 0) return maxCooldownDiff;
        return b.currentCooldown - a.currentCooldown;
      });
    const countToLock =
      this.params.maxCount === undefined
        ? matchedSkills.length
        : Math.min(
            matchedSkills.length,
            Math.max(0, Math.floor(this.params.maxCount)),
          );

    for (let i = 0; i < countToLock; i++) {
      if (!context.canExecuteEffect()) break;
      const skill = matchedSkills[i];
      skill.modifyCooldown(rounds);
      context.commit(context.target, {
        type: 'mechanic',
        code: CombatMechanicCodeV3.ABILITY_LOCK,
        payload: {
          kind: 'ability_lock',
          abilityName: skill.name,
          rounds,
        },
      });
      context.emit<CooldownModifyEvent>({
        type: 'CooldownModifyEvent',
      timestamp: context.owner.runtime.clock.now(),
        caster: context.caster,
        target: context.target,
        ability: context.ability,
        cdModifyValue: rounds,
        affectedAbilityName: skill.name,
      });
    }
  }
}

EffectRegistry.getInstance().register(
  'ability_lock',
  (params) => new AbilityLockEffect(params),
);
