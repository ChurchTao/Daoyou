import { DEFAULT_AFFIX_REGISTRY } from '@shared/engine/creation-v2/affixes';
import { describe, expect, it } from 'vitest';
import { Unit } from '../units/Unit';
import { evaluateCondition } from './conditionEvaluator';
import type { ConditionConfig } from './configs';
import { DamageSource, DamageType } from './types';

function createContext(damageType: DamageType) {
  const caster = new Unit('caster', '施法者', {});
  const target = new Unit('target', '目标', {});

  return {
    caster,
    target,
    triggerEvent: {
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster,
      target,
      damageSource: DamageSource.DIRECT,
      damageType,
      baseDamage: 100,
      finalDamage: 100,
    },
  };
}

describe('conditionEvaluator damage type conditions', () => {
  it('dot amplify affix uses damage_type_is instead of ability tag matching', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('gongfa-school-dot-amplify');
    expect(def?.effectTemplate.type).toBe('percent_damage_modifier');
    if (def?.effectTemplate.type !== 'percent_damage_modifier') return;

    expect(def.effectTemplate.conditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'damage_type_is',
          params: { damageType: DamageType.DOT },
        }),
      ]),
    );
  });

  it('matches dot damage and rejects normal direct damage', () => {
    const condition: ConditionConfig = {
      type: 'damage_type_is',
      params: { damageType: DamageType.DOT },
    };

    expect(evaluateCondition(createContext(DamageType.DOT), condition)).toBe(
      true,
    );
    expect(
      evaluateCondition(createContext(DamageType.MAGICAL), condition),
    ).toBe(false);
  });

  it('matches lethal damage windows only when trigger event is lethal', () => {
    const condition: ConditionConfig = {
      type: 'is_lethal',
      params: {},
    };
    const context = createContext(DamageType.MAGICAL);

    expect(
      evaluateCondition(
        {
          ...context,
          triggerEvent: {
            type: 'DamageTakenEvent',
            timestamp: Date.now(),
            caster: context.caster,
            target: context.target,
            damageTaken: 100,
            beforeHp: 100,
            remainHp: 0,
            isLethal: true,
          },
        },
        condition,
      ),
    ).toBe(true);
    expect(evaluateCondition(context, condition)).toBe(false);
  });
});
