import { Buff } from '../buffs/Buff';
import { EffectContext } from '../effects';
import { Unit } from '../units/Unit';
import { ConditionConfig } from './configs';
import { DamageEvent, DamageRequestEvent, DamageTakenEvent } from './events';
import { BuffType, DamageType } from './types';


function getScopedUnit(context: EffectContext, scope?: 'caster' | 'target') {
  if (scope === 'caster') return context.caster;
  return context.target;
}

function getAbilityTagsFromTriggerEvent(triggerEvent: unknown) {
  if (!triggerEvent || typeof triggerEvent !== 'object') {
    return undefined;
  }

  const eventLike = triggerEvent as {
    ability?: {
      tags?: { hasTag: (tag: string) => boolean };
    };
  };

  return eventLike.ability?.tags;
}

function getAbilityTags(context: EffectContext) {
  return getAbilityTagsFromTriggerEvent(context.triggerEvent) ?? context.ability?.tags;
}

function getDamageTypeFromTriggerEvent(triggerEvent: unknown): DamageType | undefined {
  if (!triggerEvent || typeof triggerEvent !== 'object') return undefined;

  const eventLike = triggerEvent as {
    damageType?: DamageRequestEvent['damageType'] | DamageEvent['damageType'] | DamageTakenEvent['damageType'];
  };
  return eventLike.damageType;
}

function getShieldAbsorbedFromTriggerEvent(triggerEvent: unknown): number | undefined {
  if (!triggerEvent || typeof triggerEvent !== 'object') return undefined;

  const eventLike = triggerEvent as {
    shieldAbsorbed?: number;
  };
  return eventLike.shieldAbsorbed;
}

function getIsCriticalFromTriggerEvent(triggerEvent: unknown): boolean {
  if (!triggerEvent || typeof triggerEvent !== 'object') return false;

  const eventLike = triggerEvent as {
    isCritical?: boolean;
  };
  return eventLike.isCritical === true;
}

function countBuffs(
  unit: Unit | undefined,
  predicate: (buff: Buff) => boolean,
): number {
  if (!unit?.buffs) {
    return 0;
  }

  return unit.buffs.getAllBuffs().filter(predicate).length;
}

export function evaluateCondition(
  context: EffectContext,
  cond: ConditionConfig,
): boolean {
  const scopedUnit = getScopedUnit(context, cond.params.scope);
  const threshold = cond.params.value ?? 0;

  switch (cond.type) {
    case 'has_tag':
      return cond.params.tag ? scopedUnit?.tags.hasTag(cond.params.tag) ?? false : true;
    case 'has_not_tag':
      return cond.params.tag
        ? !(scopedUnit?.tags.hasTag(cond.params.tag) ?? false)
        : true;
    case 'has_tag_on': {
      const unit = getScopedUnit(context, cond.params.scope);
      if (!unit || !cond.params.tag) return false;
      return unit.tags.hasTag(cond.params.tag);
    }
    case 'ability_has_tag': {
      const abilityTags = getAbilityTags(context);
      if (!abilityTags || !cond.params.tag) return false;
      return abilityTags.hasTag(cond.params.tag);
    }
    case 'ability_has_not_tag': {
      const abilityTags = getAbilityTags(context);
      if (!cond.params.tag) return true;
      if (!abilityTags) return true;
      return !abilityTags.hasTag(cond.params.tag);
    }
    case 'hp_above':
      return !!scopedUnit && scopedUnit.getCurrentHp() / scopedUnit.getMaxHp() > threshold;
    case 'hp_below':
      return !!scopedUnit && scopedUnit.getCurrentHp() / scopedUnit.getMaxHp() < threshold;
    case 'mp_above':
      return !!scopedUnit && scopedUnit.getCurrentMp() / scopedUnit.getMaxMp() > threshold;
    case 'mp_below':
      return !!scopedUnit && scopedUnit.getCurrentMp() / scopedUnit.getMaxMp() < threshold;
    case 'has_shield':
      return !!scopedUnit && scopedUnit.getCurrentShield() > threshold;
    case 'buff_count_at_least':
      return (
        countBuffs(scopedUnit, (buff) => buff.type === BuffType.BUFF) >= threshold
      );
    case 'debuff_count_at_least':
      return (
        countBuffs(
          scopedUnit,
          (buff) =>
            buff.type === BuffType.DEBUFF || buff.type === BuffType.CONTROL,
        ) >= threshold
      );
    case 'damage_type_is': {
      const expected = cond.params.damageType;
      if (!expected) return false;
      return getDamageTypeFromTriggerEvent(context.triggerEvent) === expected;
    }
    case 'shield_absorbed_at_least':
      return (getShieldAbsorbedFromTriggerEvent(context.triggerEvent) ?? 0) >= threshold;
    case 'chance':
      return Math.random() < threshold;
    case 'is_critical': {
      // scope 用于语义校验：'caster' 表示"我暴击了"，'target' 表示"我被暴击了"
      // 运行时都读取 triggerEvent.isCritical，因为暴击是事件级属性
      return getIsCriticalFromTriggerEvent(context.triggerEvent);
    }
    default:
      return true;
  }
}

export function checkConditions(
  context: EffectContext,
  conditions: ConditionConfig[],
): boolean {
  for (const cond of conditions) {
    if (!evaluateCondition(context, cond)) return false;
  }
  return true;
}
