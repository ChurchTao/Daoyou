import type { SkillImmunityParams } from '../core/configs';
import type { SkillPreCastEvent } from '../core/events';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectExecutionContextV3, GameplayEffect } from './Effect';

/**
 * 在施法前摇阶段拦截整个技能。
 *
 * 与 buff_immunity / damage_immunity 不同，这里不参与技能效果结算，
 * 而是直接将 SkillPreCastEvent 标记为已免疫，由 ActionExecutionSystem
 * 统一取消本次施法。因此技能的伤害、治疗、控制、Buff 和费用效果都不会执行。
 */
export class SkillImmunityEffect extends GameplayEffect {
  constructor(private readonly params: SkillImmunityParams) {
    super();
  }

  execute(context: EffectExecutionContextV3): void {
    const event = context.triggerEvent;
    if (!event || event.type !== 'SkillPreCastEvent') return;

    const skillEvent = event as SkillPreCastEvent;
    if (skillEvent.isImmune) return;
    // “受到”只指敌方施法；己方增益和自身施法不应被天威裁决拦截。
    if (skillEvent.caster.teamId === skillEvent.target.teamId) return;

    skillEvent.isImmune = true;
    skillEvent.isInterrupted = true;
    skillEvent.immunityReason = this.params.reason;
  }
}

EffectRegistry.getInstance().register(
  'skill_immunity',
  (params) => new SkillImmunityEffect(params),
);
