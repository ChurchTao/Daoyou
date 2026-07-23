import { Buff } from '../buffs/Buff';
import { EffectContext } from '../effects';
import { Unit } from '../units/Unit';
import { ConditionConfig } from './configs';
import { DamageEvent, DamageRequestEvent, DamageTakenEvent } from './events';
import { BuffType, DamageSource, DamageType } from './types';
import { readRuntimeCounter } from './runtimeState';
import { readAbilityMode } from './runtimeState';


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
      tags?: {
        hasTag: (tag: string) => boolean;
        getTags: () => string[];
      };
    };
  };

  return eventLike.ability?.tags;
}

function getAbilityTags(context: EffectContext) {
  return getAbilityTagsFromTriggerEvent(context.triggerEvent) ?? context.ability?.tags;
}

function sourceHasTag(context: EffectContext, tag: string): boolean {
  if (getAbilityTags(context)?.hasTag(tag)) return true;
  const triggerBuff = context.triggerEvent && typeof context.triggerEvent === 'object'
    ? (context.triggerEvent as { buff?: Buff }).buff
    : undefined;
  return triggerBuff?.tags.hasTag(tag) ?? context.buff?.tags.hasTag(tag) ?? false;
}

function getAbilityMpCost(context: EffectContext): number {
  const ability = (() => {
    if (
      context.triggerEvent &&
      typeof context.triggerEvent === 'object' &&
      'ability' in context.triggerEvent
    ) {
      return (context.triggerEvent as { ability?: unknown }).ability;
    }
    return context.ability;
  })();

  if (!ability || typeof ability !== 'object') {
    return 0;
  }

  const abilityLike = ability as {
    manaCost?: unknown;
    resourceCosts?: unknown;
  };
  if (typeof abilityLike.manaCost === 'number') {
    return Math.max(0, abilityLike.manaCost);
  }

  if (Array.isArray(abilityLike.resourceCosts)) {
    const mpCost = abilityLike.resourceCosts.find(
      (cost): cost is { type: 'mp'; amount: number } =>
        !!cost &&
        typeof cost === 'object' &&
        (cost as { type?: unknown }).type === 'mp' &&
        typeof (cost as { amount?: unknown }).amount === 'number',
    );
    return Math.max(0, mpCost?.amount ?? 0);
  }

  return 0;
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

function getIsLethalFromTriggerEvent(triggerEvent: unknown): boolean {
  if (!triggerEvent || typeof triggerEvent !== 'object') return false;

  const eventLike = triggerEvent as {
    isLethal?: boolean;
  };
  return eventLike.isLethal === true;
}

function countBuffs(
  unit: Unit | undefined,
  predicate: (buff: Buff) => boolean,
  countsAsStatusOnly: boolean = true,
): number {
  if (!unit?.buffs) {
    return 0;
  }

  return unit.buffs
    .getAllBuffs()
    .filter((buff) => !countsAsStatusOnly || buff.countsAsStatus)
    .filter(predicate).length;
}

export function evaluateCondition(
  context: EffectContext,
  cond: ConditionConfig,
): boolean {
  const scopedUnit = getScopedUnit(context, cond.params.scope);
  const threshold = cond.params.value ?? 0;
  const snapshotHpRatio = (() => {
    if (cond.params.timing !== 'cast' || !context.castSnapshot) return undefined;
    return cond.params.scope === 'caster'
      ? context.castSnapshot.casterHpRatioAfterCost
      : context.castSnapshot.targetHpRatioBeforeEffects;
  })();

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
    case 'ability_has_exact_tag': {
      const abilityTags = getAbilityTags(context);
      if (!abilityTags || !cond.params.tag) return false;
      return abilityTags.getTags().includes(cond.params.tag);
    }
    case 'ability_has_not_tag': {
      const abilityTags = getAbilityTags(context);
      if (!cond.params.tag) return true;
      if (!abilityTags) return true;
      return !abilityTags.hasTag(cond.params.tag);
    }
    case 'source_has_tag':
      return cond.params.tag ? sourceHasTag(context, cond.params.tag) : false;
    case 'hp_above':
      return snapshotHpRatio !== undefined
        ? snapshotHpRatio > threshold
        : !!scopedUnit && scopedUnit.getCurrentHp() / scopedUnit.getMaxHp() > threshold;
    case 'hp_below':
      return snapshotHpRatio !== undefined
        ? snapshotHpRatio < threshold
        : !!scopedUnit && scopedUnit.getCurrentHp() / scopedUnit.getMaxHp() < threshold;
    case 'mp_above':
      return !!scopedUnit && scopedUnit.getCurrentMp() / scopedUnit.getMaxMp() > threshold;
    case 'mp_below':
      return !!scopedUnit && scopedUnit.getCurrentMp() / scopedUnit.getMaxMp() < threshold;
    case 'ability_mp_cost_at_least':
      return getAbilityMpCost(context) >= threshold;
    case 'has_shield':
      return !!scopedUnit && scopedUnit.getCurrentShield() > threshold;
    case 'buff_count_at_least':
      return (
        countBuffs(scopedUnit, (buff) => buff.type === BuffType.BUFF) >= threshold
      );
    case 'buff_layer_at_least':
      return (
        countBuffs(
          scopedUnit,
          (buff) =>
            (cond.params.id ? buff.id === cond.params.id : true) &&
            (cond.params.tag ? buff.tags.hasTag(cond.params.tag) : true) &&
            buff.getLayer() >= threshold,
          false,
        ) >= 1
      );
    case 'buff_layer_below':
      return (
        countBuffs(
          scopedUnit,
          (buff) =>
            (cond.params.id ? buff.id === cond.params.id : true) &&
            (cond.params.tag ? buff.tags.hasTag(cond.params.tag) : true) &&
            buff.getLayer() >= threshold,
          false,
        ) === 0
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
    case 'damage_source_is': {
      const event = context.triggerEvent as { damageSource?: DamageSource } | undefined;
      return event?.damageSource === cond.params.damageSource;
    }
    case 'shield_absorbed_at_least':
      return (getShieldAbsorbedFromTriggerEvent(context.triggerEvent) ?? 0) >= threshold;
    case 'damage_taken_at_least': {
      const event = context.triggerEvent as { damageTaken?: number } | undefined;
      return (event?.damageTaken ?? 0) >= threshold;
    }
    case 'resource_compare': {
      const left = getScopedUnit(context, cond.params.left);
      const right = getScopedUnit(context, cond.params.right);
      if (!left || !right) return false;
      const resource = cond.params.resource ?? 'mp';
      const leftValue = resource === 'hp' ? left.getCurrentHp() : left.getCurrentMp();
      const rightValue = resource === 'hp' ? right.getCurrentHp() : right.getCurrentMp();
      switch (cond.params.op ?? 'gt') {
        case 'gte':
          return leftValue >= rightValue;
        case 'lt':
          return leftValue < rightValue;
        case 'lte':
          return leftValue <= rightValue;
        case 'gt':
        default:
          return leftValue > rightValue;
      }
    }
    case 'attribute_compare': {
      const left = getScopedUnit(context, cond.params.left);
      const right = getScopedUnit(context, cond.params.right);
      if (!left || !right || !cond.params.attribute) return false;
      const leftValue = left.attributes.getValue(cond.params.attribute);
      const rightValue = right.attributes.getValue(cond.params.attribute);
      switch (cond.params.op ?? 'gt') {
        case 'gte': return leftValue >= rightValue;
        case 'lt': return leftValue < rightValue;
        case 'lte': return leftValue <= rightValue;
        case 'gt':
        default: return leftValue > rightValue;
      }
    }
    case 'combat_resource_at_least':
      return !!(
        scopedUnit &&
        cond.params.resourceId &&
        scopedUnit.combatResources.getCurrent(cond.params.resourceId) >= threshold
      );
    case 'combat_resource_below':
      return !!(
        scopedUnit &&
        cond.params.resourceId &&
        scopedUnit.combatResources.getCurrent(cond.params.resourceId) < threshold
      );
    case 'runtime_counter_compare': {
      if (!scopedUnit || !cond.params.key) return false;
      const value = readRuntimeCounter(scopedUnit, cond.params.key);
      switch (cond.params.op ?? 'gte') {
        case 'gt': return value > threshold;
        case 'lt': return value < threshold;
        case 'lte': return value <= threshold;
        case 'gte':
        default: return value >= threshold;
      }
    }
    case 'ability_mode_is': {
      if (!scopedUnit || !cond.params.key || !cond.params.mode) return false;
      const mode = readAbilityMode(scopedUnit, cond.params.key);
      if (cond.params.mode === 'none') return mode === undefined;
      return (
        mode?.mode === cond.params.mode &&
        (cond.params.remainingUses === undefined ||
          mode.remainingUses === cond.params.remainingUses)
      );
    }
    case 'ability_cost_crossed': {
      const event = context.triggerEvent as {
        type?: string;
        beforeHpRatio?: number;
        afterHpRatio?: number;
      } | undefined;
      const ratio = cond.params.value;
      return (
        event?.type === 'AbilityCostPaidEvent' &&
        ratio !== undefined &&
        (event.beforeHpRatio ?? -1) >= ratio &&
        (event.afterHpRatio ?? 1) < ratio
      );
    }
    case 'combat_resource_change': {
      const event = context.triggerEvent as {
        type?: string;
        resourceId?: string;
        operation?: string;
        requested?: number;
        applied?: number;
        overflow?: number;
      } | undefined;
      if (event?.type !== 'CombatResourceChangeEvent') return false;
      if (cond.params.resourceId && event.resourceId !== cond.params.resourceId) return false;
      if (cond.params.operation && event.operation !== cond.params.operation) return false;
      const field = (
        cond.params.eventField === 'requested' ||
        cond.params.eventField === 'overflow'
      ) ? cond.params.eventField : 'applied';
      const value = event[field] ?? 0;
      switch (cond.params.op ?? 'gte') {
        case 'gt': return value > threshold;
        case 'lt': return value < threshold;
        case 'lte': return value <= threshold;
        case 'gte':
        default: return value >= threshold;
      }
    }
    case 'buff_layer_change': {
      const event = context.triggerEvent as {
        type?: string;
        buff?: Buff;
        previousLayer?: number;
        currentLayer?: number;
        delta?: number;
        reason?: string;
      } | undefined;
      if (event?.type !== 'BuffLayerChangedEvent' || !event.buff) return false;
      if (cond.params.id && event.buff.id !== cond.params.id) return false;
      if (cond.params.tag && !event.buff.tags.hasTag(cond.params.tag)) return false;
      if (cond.params.reason && event.reason !== cond.params.reason) return false;
      const field = cond.params.eventField ?? 'delta';
      if (field !== 'previousLayer' && field !== 'currentLayer' && field !== 'delta') {
        return false;
      }
      const value = event[field] ?? 0;
      switch (cond.params.op ?? 'gte') {
        case 'gt': return value > threshold;
        case 'lt': return value < threshold;
        case 'lte': return value <= threshold;
        case 'gte':
        default: return value >= threshold;
      }
    }
    case 'buff_removed_reason_is': {
      const event = context.triggerEvent as {
        type?: string;
        buff?: Buff;
        reason?: string;
      } | undefined;
      if (event?.type !== 'BuffRemovedEvent' || !event.buff) return false;
      if (cond.params.id && event.buff.id !== cond.params.id) return false;
      if (cond.params.tag && !event.buff.tags.hasTag(cond.params.tag)) return false;
      return !cond.params.reason || event.reason === cond.params.reason;
    }
    case 'chance':
      return battleRandom() < threshold;
    case 'is_critical': {
      // scope 用于语义校验：'caster' 表示"我暴击了"，'target' 表示"我被暴击了"
      // 运行时都读取 triggerEvent.isCritical，因为暴击是事件级属性
      return getIsCriticalFromTriggerEvent(context.triggerEvent);
    }
    case 'is_hit': {
      const event = context.triggerEvent as { isHit?: boolean } | undefined;
      return event?.isHit === true;
    }
    case 'is_lethal':
      return getIsLethalFromTriggerEvent(context.triggerEvent);
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
import { battleRandom } from './BattleRandom';
