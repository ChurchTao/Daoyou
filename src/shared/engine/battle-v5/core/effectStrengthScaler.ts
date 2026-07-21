import type { BuffConfig, EffectConfig } from './configs';
import type { ScalableValue } from './ValueCalculator';

function scaleValue(value: ScalableValue, multiplier: number): ScalableValue {
  return {
    ...value,
    base: value.base === undefined ? undefined : value.base * multiplier,
    coefficient: value.attribute
      ? (value.coefficient ?? 1) * multiplier
      : value.coefficient,
    targetMaxHpRatio: value.targetMaxHpRatio === undefined
      ? undefined
      : value.targetMaxHpRatio * multiplier,
    targetMaxMpRatio: value.targetMaxMpRatio === undefined
      ? undefined
      : value.targetMaxMpRatio * multiplier,
  };
}

function scaleBuff(config: BuffConfig, multiplier: number): BuffConfig {
  return {
    ...config,
    modifiers: config.modifiers?.map((modifier) => ({
      ...modifier,
      value: modifier.value * multiplier,
    })),
    listeners: config.listeners?.map((listener) => ({
      ...listener,
      effects: listener.effects.map((effect) =>
        scaleEffectNumericStrength(effect, multiplier)),
    })),
  };
}

function assertNever(value: never): never {
  throw new Error(`未处理的效果强度缩放类型: ${JSON.stringify(value)}`);
}

/**
 * 只缩放效果的连续数值强度。持续时间、触发次数、目标数和状态操作等离散语义保持不变。
 */
export function scaleEffectNumericStrength(
  effect: EffectConfig,
  multiplier: number,
): EffectConfig {
  if (multiplier === 1) return effect;
  switch (effect.type) {
    case 'damage':
      return {
        ...effect,
        params: {
          ...effect.params,
          value: scaleValue(effect.params.value, multiplier),
          dynamicScalars: effect.params.dynamicScalars?.map((scalar) => ({
            ...scalar,
            coefficientCap: scalar.coefficientCap * multiplier,
          })),
        },
      };
    case 'heal':
    case 'shield':
    case 'mana_burn':
      return {
        ...effect,
        params: { ...effect.params, value: scaleValue(effect.params.value, multiplier) },
      } as EffectConfig;
    case 'apply_buff':
      return {
        ...effect,
        params: { ...effect.params, buffConfig: scaleBuff(effect.params.buffConfig, multiplier) },
      };
    case 'resource_drain':
      return { ...effect, params: { ...effect.params, ratio: effect.params.ratio * multiplier } };
    case 'magic_shield':
      return {
        ...effect,
        params: {
          ...effect.params,
          absorbRatio: effect.params.absorbRatio === undefined
            ? undefined
            : effect.params.absorbRatio * multiplier,
        },
      };
    case 'reflect':
      return {
        ...effect,
        params: {
          ...effect.params,
          ratio: effect.params.ratio * multiplier,
          ratioPerLayer: effect.params.ratioPerLayer === undefined
            ? undefined
            : effect.params.ratioPerLayer * multiplier,
          maxHpRatioPerAction: effect.params.maxHpRatioPerAction === undefined
            ? undefined
            : effect.params.maxHpRatioPerAction * multiplier,
        },
      };
    case 'tag_trigger':
      return {
        ...effect,
        params: {
          ...effect.params,
          damageRatio: effect.params.damageRatio === undefined
            ? undefined
            : effect.params.damageRatio * multiplier,
          effects: effect.params.effects?.map((child) =>
            scaleEffectNumericStrength(child, multiplier)),
        },
      };
    case 'consume_status_trigger':
      return {
        ...effect,
        params: {
          ...effect.params,
          effects: effect.params.effects.map((child) =>
            scaleEffectNumericStrength(child, multiplier)),
        },
      };
    case 'delayed_effect':
      return {
        ...effect,
        params: {
          ...effect.params,
          effects: effect.params.effects.map((child) =>
            scaleEffectNumericStrength(child, multiplier)),
          record: effect.params.record
            ? {
                ...effect.params.record,
                maxStoredValue: effect.params.record.maxStoredValue
                  ? scaleValue(effect.params.record.maxStoredValue, multiplier)
                  : undefined,
              }
            : undefined,
        },
      };
    case 'damage_memory':
      return {
        ...effect,
        params: {
          ...effect.params,
          ratio: effect.params.ratio === undefined ? undefined : effect.params.ratio * multiplier,
          maxStoredValue: effect.params.maxStoredValue
            ? scaleValue(effect.params.maxStoredValue, multiplier)
            : undefined,
          maxReleaseValue: effect.params.maxReleaseValue
            ? scaleValue(effect.params.maxReleaseValue, multiplier)
            : undefined,
        },
      };
    case 'buff_layer_modify':
    case 'combat_resource_modify':
    case 'runtime_counter_modify':
      return {
        ...effect,
        params: {
          ...effect.params,
          effects: effect.params.effects?.map((child) =>
            scaleEffectNumericStrength(child, multiplier)),
        },
      } as EffectConfig;
    case 'ability_transform':
      return {
        ...effect,
        params: {
          ...effect.params,
          bonusDamageMemory: effect.params.bonusDamageMemory
            ? {
                ...effect.params.bonusDamageMemory,
                ratio: (effect.params.bonusDamageMemory.ratio ?? 1) * multiplier,
              }
            : undefined,
        },
      };
    case 'hp_sacrifice_damage':
      return {
        ...effect,
        params: { ...effect.params, damagePerHp: effect.params.damagePerHp * multiplier },
      };
    case 'damage_defer':
      return {
        ...effect,
        params: {
          ...effect.params,
          ratio: effect.params.ratio * multiplier,
          memory: effect.params.memory
            ? {
                ...effect.params.memory,
                maxStoredValue: effect.params.memory.maxStoredValue
                  ? scaleValue(effect.params.memory.maxStoredValue, multiplier)
                  : undefined,
              }
            : undefined,
        },
      };
    case 'dynamic_scalar':
      return {
        ...effect,
        params: {
          ...effect.params,
          value: effect.params.value * multiplier,
          cap: effect.params.cap === undefined ? undefined : effect.params.cap * multiplier,
        },
      };
    case 'turn_state_counter':
    case 'element_history':
      return {
        ...effect,
        params: {
          ...effect.params,
          effects: effect.params.effects.map((child) =>
            scaleEffectNumericStrength(child, multiplier)),
        },
      } as EffectConfig;
    case 'effect_sequence':
      return {
        ...effect,
        params: {
          ...effect.params,
          effects: effect.params.effects.map((child) =>
            scaleEffectNumericStrength(child, multiplier)),
        },
      };
    case 'status_transfer':
      return {
        ...effect,
        params: {
          ...effect.params,
          effects: effect.params.effects?.map((child) =>
            scaleEffectNumericStrength(child, multiplier)),
          fallbackEffects: effect.params.fallbackEffects?.map((child) =>
            scaleEffectNumericStrength(child, multiplier)),
        },
      };
    case 'lifesteal':
      return {
        ...effect,
        params: {
          ...effect.params,
          ratio: effect.params.ratio * multiplier,
          maxHpRatioPerAction: effect.params.maxHpRatioPerAction * multiplier,
        },
      };
    case 'damage_cap':
      return {
        ...effect,
        params: {
          ...effect.params,
          maxHpRatio: multiplier > 0
            ? effect.params.maxHpRatio / multiplier
            : effect.params.maxHpRatio,
        },
      };
    case 'percent_damage_modifier':
      return {
        ...effect,
        params: {
          ...effect.params,
          value: effect.params.value * multiplier,
          cap: effect.params.cap === undefined ? undefined : effect.params.cap * multiplier,
        },
      };
    case 'queue_action':
      return {
        ...effect,
        params: {
          ...effect.params,
          effects: effect.params.effects.map((child) =>
            scaleEffectNumericStrength(child, multiplier)),
          cancelEffects: effect.params.cancelEffects?.map((child) =>
            scaleEffectNumericStrength(child, multiplier)),
        },
      };
    case 'resource_scaled_damage':
      return {
        ...effect,
        params: {
          ...effect.params,
          baseCoefficient: effect.params.baseCoefficient * multiplier,
          coefficientPerPoint: effect.params.coefficientPerPoint * multiplier,
          bypassDefenseRatio: effect.params.bypassDefenseRatio === undefined
            ? undefined
            : effect.params.bypassDefenseRatio * multiplier,
        },
      };
    case 'dispel':
    case 'cooldown_modify':
    case 'buff_duration_modify':
    case 'ability_lock':
    case 'status_spread':
    case 'buff_copy':
    case 'next_hit_rule':
    case 'ability_mode':
    case 'death_prevent':
    case 'buff_immunity':
    case 'damage_immunity':
    case 'skip_action':
      return effect;
    default:
      return assertNever(effect);
  }
}

export function scaleEffectListNumericStrength(
  effects: EffectConfig[],
  multiplier: number,
): EffectConfig[] {
  return effects.map((effect) => scaleEffectNumericStrength(effect, multiplier));
}
