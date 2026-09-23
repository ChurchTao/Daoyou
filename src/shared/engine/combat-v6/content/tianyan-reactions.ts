import { type SkillEffect } from '../core';
import type { CombatModifier } from '../core/types';
import { TIANYAN_FOUNDATION, type TianyanElementV1, type loadTianyanFoundation } from './tianyan-foundation';

export function compileTianyanReactionEffects(element: TianyanElementV1, pack: ReturnType<typeof loadTianyanFoundation> = TIANYAN_FOUNDATION): SkillEffect[] {
  return pack.reactions.filter(r => r.newElement === element).flatMap(r => {
    const when = { requireStatusIds: [pack.elements.find(e => e.element === r.oldElement)!.markId] };
    return [{ type: 'emitMechanic' as const, mechanicId: r.id, name: r.name, targeting: { side: 'self' as const }, when },
      ...r.effects.map(e => ({ ...structuredClone(e), when: { ...e.when, ...when } }))];
  });
}
export function compileTianyanReactionModifiers(element: TianyanElementV1): CombatModifier[] {
  return TIANYAN_FOUNDATION.reactions.filter(r => r.newElement === element).flatMap(r => (r.modifiers ?? []).map(m => ({ ...m, when: { ...m.when, skillIds: [TIANYAN_FOUNDATION.elements.find(e => e.element === element)!.skillId], requireStatusIds: [TIANYAN_FOUNDATION.elements.find(e => e.element === r.oldElement)!.markId] } })));
}
