import { ActiveSkill } from '../abilities/ActiveSkill';
import { AbilityLockParams } from '../core/configs';
import { EventBus } from '../core/EventBus';
import { CooldownModifyEvent } from '../core/events';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';

export class AbilityLockEffect extends GameplayEffect {
  constructor(private params: AbilityLockParams) {
    super();
  }

  execute(context: EffectContext): void {
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
      const skill = matchedSkills[i];
      skill.modifyCooldown(rounds);
      EventBus.instance.publish<CooldownModifyEvent>({
        type: 'CooldownModifyEvent',
        timestamp: Date.now(),
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
