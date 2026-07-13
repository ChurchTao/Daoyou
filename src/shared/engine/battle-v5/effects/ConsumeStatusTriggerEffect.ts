import { ConsumeStatusTriggerParams } from '../core/configs';
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
    const matched = findMatchingBuffs(context.target, this.params.match);
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
      context.target.buffs.setBuffLayer(buff.id, 0);
    } else {
      const layers = typeof consume === 'number' ? consume : 1;
      context.target.buffs.modifyBuffLayer(buff.id, -Math.max(1, layers));
    }

    publishMechanicLog({
      mechanic: 'buff_layer',
      source: context.caster,
      target: context.target,
      name: buff.name,
      value: consumedLayers,
      detail: 'consumed',
    });

    const effects = this.params.effects.length > 0 ? this.params.effects : delayedEffects ?? [];
    const repeats = this.params.scaleEffectsByLayer ? consumedLayers : 1;
    for (let index = 0; index < repeats; index += 1) {
      executeEffectConfigs(effects, context);
    }
  }
}

EffectRegistry.getInstance().register(
  'consume_status_trigger',
  (params) => new ConsumeStatusTriggerEffect(params),
);
