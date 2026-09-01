import type { ConsumeStatusTriggerParams, EffectConfig } from '../core/configs';
import { executeEffectConfigs } from '../core/effectExecutor';
import { getDelayedBuffEffects } from '../core/runtimeState';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectExecutionContextV3, GameplayEffect } from './Effect';
import { findMatchingBuffs } from './advancedEffectUtils';

export class ConsumeStatusTriggerEffect extends GameplayEffect {
  constructor(private params: ConsumeStatusTriggerParams) {
    super();
  }

  execute(context: EffectExecutionContextV3): void {
    const unit =
      this.params.target === 'caster' ? context.caster : context.target;
    const matched = findMatchingBuffs(unit, this.params.match);
    const buff = matched[0];
    if (!buff) {
      executeEffectConfigs(this.params.fallbackEffects ?? [], context);
      return;
    }

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
      unit.buffs.setBuffLayer(buff.id, 0, {
        source: context.caster,
        ability: context.ability,
        buff: context.buff,
        attribution: context.attribution,
        trace: context.trace,
        resolution: context.resolution,
        layerChangeReason: 'consumed',
        statusDisplayName: this.params.displayName,
      });
    } else {
      const layers = typeof consume === 'number' ? consume : 1;
      unit.buffs.modifyBuffLayer(buff.id, -Math.max(1, layers), {
        source: context.caster,
        ability: context.ability,
        buff: context.buff,
        attribution: context.attribution,
        trace: context.trace,
        resolution: context.resolution,
        layerChangeReason: 'consumed',
        statusDisplayName: this.params.displayName,
      });
    }

    const configuredEffects =
      this.params.effects.length > 0
        ? this.params.effects
        : (delayedEffects ?? []);
    const effects = this.params.aggregateDamageByLayer
      ? configuredEffects.map((effect) => aggregateDirectDamage(effect, consumedLayers))
      : configuredEffects;
    const repeats = this.params.scaleEffectsByLayer && !this.params.aggregateDamageByLayer
      ? consumedLayers
      : 1;
    for (let index = 0; index < repeats; index += 1) {
      if (!context.canExecuteEffect()) break;
      executeEffectConfigs(effects, context);
    }
  }
}

function aggregateDirectDamage(effect: EffectConfig, consumedLayers: number): EffectConfig {
  if (effect.type !== 'damage' || consumedLayers === 1) return effect;
  const value = effect.params.value;
  return {
    ...effect,
    params: {
      ...effect.params,
      value: {
        ...value,
        base: value.base === undefined ? undefined : value.base * consumedLayers,
        coefficient: value.attribute
          ? (value.coefficient ?? 1) * consumedLayers
          : value.coefficient,
        targetMaxHpRatio: value.targetMaxHpRatio === undefined
          ? undefined
          : value.targetMaxHpRatio * consumedLayers,
        targetMaxMpRatio: value.targetMaxMpRatio === undefined
          ? undefined
          : value.targetMaxMpRatio * consumedLayers,
      },
      dynamicScalars: effect.params.dynamicScalars?.map((scalar) => ({
        ...scalar,
        coefficientCap: scalar.coefficientCap * consumedLayers,
      })),
    },
  };
}

EffectRegistry.getInstance().register(
  'consume_status_trigger',
  (params) => new ConsumeStatusTriggerEffect(params),
);
