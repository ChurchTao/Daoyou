import type {
  BuffConfig,
  ConsumeStatusTriggerParams,
  EffectConfig,
} from '../core/configs';
import type { ScalableValue } from '../core/ValueCalculator';
import { executeEffectConfigs } from '../core/effectExecutor';
import { getDelayedBuffEffects } from '../core/runtimeState';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';
import { findMatchingBuffs, publishMechanicLog } from './advancedEffectUtils';

export class ConsumeStatusTriggerEffect extends GameplayEffect {
  constructor(private params: ConsumeStatusTriggerParams) {
    super();
  }

  execute(context: EffectContext): void {
    const unit = this.params.target === 'caster' ? context.caster : context.target;
    const matched = findMatchingBuffs(unit, this.params.match);
    const buff = matched[0];
    if (!buff) return;

    const consume = this.params.consume ?? 'one';
    const beforeLayer = buff.getLayer();
    const delayedEffects = getDelayedBuffEffects(buff);
    const consumedLayers =
      consume === 'all'
        ? beforeLayer
        : Math.min(
            beforeLayer,
            typeof consume === 'number' ? Math.max(1, consume) : 1,
          );
    if (consume === 'all') {
      unit.buffs.setBuffLayer(buff.id, 0);
    } else {
      const layers = typeof consume === 'number' ? consume : 1;
      unit.buffs.modifyBuffLayer(buff.id, -Math.max(1, layers));
    }

    publishMechanicLog({
      mechanic: 'buff_layer',
      source: context.caster,
      ability: context.ability,
      sourceBuff: context.buff,
      target: unit,
      name: buff.name,
      displayName: this.params.displayName ?? buff.name,
      visibility: 'player',
      value: consumedLayers,
      detail: 'consumed',
    });

    const configuredEffects = this.params.effects.length > 0
      ? this.params.effects
      : delayedEffects ?? [];
    const effects = this.params.scaleNumericEffectsByLayer
      ? configuredEffects.map((effect) => scaleEffectStrength(effect, consumedLayers))
      : configuredEffects;
    const repeats = this.params.scaleEffectsByLayer ? consumedLayers : 1;
    for (let index = 0; index < repeats; index += 1) {
      executeEffectConfigs(effects, context);
    }
  }
}

function scaleValue(value: ScalableValue, scale: number): ScalableValue {
  return {
    ...value,
    base: value.base === undefined ? undefined : value.base * scale,
    coefficient: value.coefficient === undefined
      ? undefined
      : value.coefficient * scale,
    targetMaxHpRatio: value.targetMaxHpRatio === undefined
      ? undefined
      : value.targetMaxHpRatio * scale,
    targetMaxMpRatio: value.targetMaxMpRatio === undefined
      ? undefined
      : value.targetMaxMpRatio * scale,
  };
}

function scaleBuff(config: BuffConfig, scale: number): BuffConfig {
  return {
    ...config,
    modifiers: config.modifiers?.map((modifier) => ({
      ...modifier,
      value: modifier.value * scale,
    })),
    listeners: config.listeners?.map((listener) => ({
      ...listener,
      effects: listener.effects.map((effect) => scaleEffectStrength(effect, scale)),
    })),
  };
}

/** 缩放条款数值而不复制驱散、转移、封招或目标数量等离散行为。 */
function scaleEffectStrength(effect: EffectConfig, scale: number): EffectConfig {
  switch (effect.type) {
    case 'damage':
      return {
        ...effect,
        params: {
          ...effect.params,
          value: scaleValue(effect.params.value, scale),
          targetMissingHpAtkCoefficientCap:
            effect.params.targetMissingHpAtkCoefficientCap === undefined
              ? undefined
              : effect.params.targetMissingHpAtkCoefficientCap * scale,
        },
      };
    case 'heal':
    case 'shield':
    case 'mana_burn':
      return {
        ...effect,
        params: { ...effect.params, value: scaleValue(effect.params.value, scale) },
      } as EffectConfig;
    case 'apply_buff':
      return {
        ...effect,
        params: {
          ...effect.params,
          buffConfig: scaleBuff(effect.params.buffConfig, scale),
        },
      };
    case 'reflect':
      return {
        ...effect,
        params: {
          ...effect.params,
          ratio: effect.params.ratio * scale,
          ratioPerLayer: effect.params.ratioPerLayer === undefined
            ? undefined
            : effect.params.ratioPerLayer * scale,
        },
      };
    case 'percent_damage_modifier':
      return {
        ...effect,
        params: { ...effect.params, value: effect.params.value * scale },
      };
    case 'damage_memory':
      return {
        ...effect,
        params: {
          ...effect.params,
          ratio: effect.params.ratio === undefined ? undefined : effect.params.ratio * scale,
          maxReleaseValue: effect.params.maxReleaseValue
            ? scaleValue(effect.params.maxReleaseValue, scale)
            : undefined,
        },
      };
    case 'damage_defer':
      return {
        ...effect,
        params: { ...effect.params, ratio: effect.params.ratio * scale },
      };
    case 'lifesteal':
      return {
        ...effect,
        params: { ...effect.params, ratio: effect.params.ratio * scale },
      };
    case 'status_transfer':
      return {
        ...effect,
        params: {
          ...effect.params,
          effects: effect.params.effects?.map((child) => scaleEffectStrength(child, scale)),
          fallbackEffects: effect.params.fallbackEffects?.map((child) =>
            scaleEffectStrength(child, scale)),
        },
      };
    case 'effect_sequence':
      return {
        ...effect,
        params: {
          ...effect.params,
          effects: effect.params.effects.map((child) => scaleEffectStrength(child, scale)),
        },
      };
    case 'delayed_effect':
      return {
        ...effect,
        params: {
          ...effect.params,
          effects: effect.params.effects.map((child) => scaleEffectStrength(child, scale)),
        },
      };
    default:
      return effect;
  }
}

EffectRegistry.getInstance().register(
  'consume_status_trigger',
  (params) => new ConsumeStatusTriggerEffect(params),
);
