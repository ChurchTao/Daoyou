import { ConditionConfig } from './configs';
import { DamageEvent, DamageRequestEvent, DamageTakenEvent } from './events';
import { DamageType } from './types';

interface ConditionContext {
  caster?: {
    tags: { hasTag: (tag: string) => boolean };
    getCurrentHp: () => number;
    getMaxHp: () => number;
    getCurrentMp: () => number;
    getMaxMp: () => number;
  };
  target: {
    tags: { hasTag: (tag: string) => boolean };
    getCurrentHp: () => number;
    getMaxHp: () => number;
    getCurrentMp: () => number;
    getMaxMp: () => number;
  };
  triggerEvent?: unknown;
}

function getScopedUnit(context: ConditionContext, scope?: 'caster' | 'target') {
  if (scope === 'caster') return context.caster;
  return context.target;
}

function getDamageTypeFromTriggerEvent(triggerEvent: unknown): DamageType | undefined {
  if (!triggerEvent || typeof triggerEvent !== 'object') return undefined;

  const eventLike = triggerEvent as {
    damageType?: DamageRequestEvent['damageType'] | DamageEvent['damageType'] | DamageTakenEvent['damageType'];
  };
  return eventLike.damageType;
}

export function evaluateCondition(
  context: ConditionContext,
  cond: ConditionConfig,
): boolean {
  const { target } = context;
  const scopedUnit = getScopedUnit(context, cond.params.scope) ?? target;
  const threshold = cond.params.value ?? 0;

  switch (cond.type) {
    case 'has_tag':
      return cond.params.tag ? target.tags.hasTag(cond.params.tag) : true;
    case 'has_not_tag':
      return cond.params.tag ? !target.tags.hasTag(cond.params.tag) : true;
    case 'has_tag_on': {
      const unit = getScopedUnit(context, cond.params.scope);
      if (!unit || !cond.params.tag) return false;
      return unit.tags.hasTag(cond.params.tag);
    }
    case 'hp_above':
      return scopedUnit.getCurrentHp() / scopedUnit.getMaxHp() > threshold;
    case 'hp_below':
      return scopedUnit.getCurrentHp() / scopedUnit.getMaxHp() < threshold;
    case 'mp_above':
      return scopedUnit.getCurrentMp() / scopedUnit.getMaxMp() > threshold;
    case 'mp_below':
      return scopedUnit.getCurrentMp() / scopedUnit.getMaxMp() < threshold;
    case 'damage_type_is': {
      const expected = cond.params.damageType;
      if (!expected) return false;
      return getDamageTypeFromTriggerEvent(context.triggerEvent) === expected;
    }
    case 'chance':
      return Math.random() < threshold;
    default:
      return true;
  }
}

export function checkConditions(
  context: ConditionContext,
  conditions: ConditionConfig[],
): boolean {
  for (const cond of conditions) {
    if (!evaluateCondition(context, cond)) return false;
  }
  return true;
}
