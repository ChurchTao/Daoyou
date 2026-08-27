import { BuffLayerModifyParams } from '../core/configs';
import { executeEffectConfigs } from '../core/effectExecutor';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectExecutionContextV3, GameplayEffect } from './Effect';
import { findMatchingBuffs } from './advancedEffectUtils';

export class BuffLayerModifyEffect extends GameplayEffect {
  constructor(private params: BuffLayerModifyParams) {
    super();
  }

  execute(context: EffectExecutionContextV3): void {
    const unit =
      this.params.target === 'caster' ? context.caster : context.target;
    const origin = {
      source: context.caster,
      ability: context.ability,
      buff: context.buff,
      attribution: context.attribution,
      trace: context.trace,
      resolution: context.resolution,
      layerChangeReason: 'modified' as const,
      statusFactVisibility: this.params.logVisibility,
    };
    for (const buff of findMatchingBuffs(unit, this.params.match)) {
      if (!context.canExecuteEffect()) break;
      const before = buff.getLayer();
      switch (this.params.operation) {
        case 'add':
          unit.buffs.modifyBuffLayer(
            buff.id,
            Math.max(1, this.params.layers ?? 1),
            origin,
          );
          break;
        case 'subtract':
          unit.buffs.modifyBuffLayer(
            buff.id,
            -Math.max(1, this.params.layers ?? 1),
            origin,
          );
          break;
        case 'clear':
          unit.buffs.setBuffLayer(buff.id, 0, origin);
          break;
        case 'set':
          unit.buffs.setBuffLayer(
            buff.id,
            this.params.layers ?? 1,
            origin,
          );
          break;
      }

      const repeat = this.params.scaleEffectsByLayer ? before : 1;
      for (let i = 0; i < repeat; i++) {
        if (!context.canExecuteEffect()) break;
        executeEffectConfigs(this.params.effects ?? [], context);
      }
    }
  }
}

EffectRegistry.getInstance().register(
  'buff_layer_modify',
  (params) => new BuffLayerModifyEffect(params),
);
