import type { EffectConfig } from '@shared/engine/battle-v5/core/configs';
import { EventPriorityLevel } from '@shared/engine/battle-v5/core/events';
import {
  AttributeType,
  DamageSource,
  DamageType,
} from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import type { SectMethodGrowthPolicy } from '../domain';

export const DIRECT_DAMAGE_CONDITION = {
  type: 'damage_source_is' as const,
  params: { damageSource: DamageSource.DIRECT },
};
export const DAMAGE_MODIFIER_PRIORITY = EventPriorityLevel.DAMAGE_REQUEST + 1;

export class SectEffectFactory {
  physicalDamage(
    coefficient: number,
    conditions?: EffectConfig['conditions'],
    bypassDefense = false,
    damageSource: DamageSource = DamageSource.DIRECT,
  ): EffectConfig {
    return {
      type: 'damage',
      params: {
        value: { attribute: AttributeType.ATK, coefficient },
        damageType: DamageType.PHYSICAL,
        bypassDefense,
        damageSource,
      },
      conditions,
    };
  }

  healMaxHp(
    ratio: number,
    recipient: 'caster' | 'target' = 'target',
  ): EffectConfig {
    return {
      type: 'heal',
      params: { value: { targetMaxHpRatio: ratio }, target: 'hp', recipient },
    };
  }

  shieldByAttack(
    coefficient: number,
    conditions?: EffectConfig['conditions'],
    target: 'caster' | 'target' = 'target',
  ): EffectConfig {
    return {
      type: 'shield',
      params: { value: { attribute: AttributeType.ATK, coefficient }, target },
      conditions,
    };
  }

  modifyResource(
    resourceId: string,
    amount: number,
    conditions?: EffectConfig['conditions'],
    reason?: 'gain' | 'spend' | 'refund',
  ): EffectConfig {
    return {
      type: 'combat_resource_modify',
      params: {
        resourceId,
        operation: amount >= 0 ? 'add' : 'subtract',
        amount: Math.abs(amount),
        reason,
      },
      conditions,
    };
  }

  consumeResource(resourceId: string): EffectConfig {
    return {
      type: 'combat_resource_modify',
      params: { resourceId, operation: 'consume_all' },
    };
  }

  dispelPositiveBuffsByMethod(
    baseCount: number,
    methodLevel: number | undefined,
    methodGrowth: SectMethodGrowthPolicy,
  ): EffectConfig {
    return {
      type: 'dispel',
      params: {
        targetTag: GameplayTags.BUFF.TYPE.BUFF,
        maxCount: methodGrowth.growCount(
          baseCount,
          methodLevel,
        ),
      },
    };
  }

  modifyCounter(
    key: string,
    operation: 'add' | 'subtract' | 'set' | 'reset',
    options: {
      amount?: number;
      amountFromEvent?: 'requested' | 'applied' | 'overflow';
      max?: number;
      effects?: EffectConfig[];
      scaleEffectsByAmount?: boolean;
      conditions?: EffectConfig['conditions'];
    } = {},
  ): EffectConfig {
    return {
      type: 'runtime_counter_modify',
      params: {
        key,
        operation,
        amount: options.amount,
        amountFromEvent: options.amountFromEvent,
        max: options.max,
        effects: options.effects,
        scaleEffectsByAmount: options.scaleEffectsByAmount,
      },
      conditions: options.conditions,
    };
  }

  counterCondition(
    key: string,
    op: 'gt' | 'gte' | 'lt' | 'lte',
    value: number,
  ) {
    return {
      type: 'runtime_counter_compare' as const,
      params: { key, op, value, scope: 'caster' as const },
    };
  }

  resourceChangeCondition(
    resourceId: string,
    eventField: 'requested' | 'applied' | 'overflow',
    value: number,
  ) {
    return {
      type: 'combat_resource_change' as const,
      params: {
        resourceId,
        operation: 'add' as const,
        eventField,
        op: 'gte' as const,
        value,
      },
    };
  }
}

export const sectEffects = new SectEffectFactory();
