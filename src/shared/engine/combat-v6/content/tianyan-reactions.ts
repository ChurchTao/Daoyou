import { DamageOrigin, EffectType, TargetMode, TargetSide, type SkillEffect } from '../core';
import { TIANYAN_FOUNDATION, type loadTianyanFoundation, type TianyanElementV1 } from './tianyan-foundation';

export function compileTianyanReactionEffects(element: TianyanElementV1, pack: ReturnType<typeof loadTianyanFoundation> = TIANYAN_FOUNDATION): SkillEffect[] {
  const markByElement = Object.fromEntries(pack.elements.map(entry => [entry.element, entry.markId])) as Record<TianyanElementV1, string>
  return pack.reactions.filter((reaction) => reaction.newElement === element).flatMap((reaction) => {
    const when = { primaryTargetStatusIds: [markByElement[reaction.oldElement]] }
    const effects: SkillEffect[] = [{ type: EffectType.EmitMechanic, mechanicId: reaction.id, name: reaction.name, when }]
    if (reaction.followPower) effects.push({ type: EffectType.FixedHit, power: reaction.followPower, formula: "fixed", origin: DamageOrigin.HookDerived, when })
    if (reaction.statusId) effects.push({
      type: EffectType.ApplyStatus,
      statusId: reaction.statusId,
      duration: pack.statusApplications[reaction.statusId].duration,
      hit: pack.statusApplications[reaction.statusId].hit,
      when,
    })
    if (reaction.healingPower) effects.push({ type: EffectType.Heal, power: reaction.healingPower, targeting: { side: TargetSide.Ally, mode: TargetMode.LowestHp, count: 1 }, when })
    effects.push(
      { type: EffectType.RemoveStatus, statusIds: [markByElement[reaction.oldElement]], maxCount: 1, when },
      { type: EffectType.ModifyResource, resourceId: pack.reactionResource.id, amount: pack.reactionResource.amount, maxGainPerAction: pack.reactionResource.maxGainPerAction, when },
    )
    return effects
  })
}
