import { BuffLayerModifyParams } from '../core/configs';
import { executeEffectConfigs } from '../core/effectExecutor';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';
import { findMatchingBuffs, publishMechanicLog } from './advancedEffectUtils';

export class BuffLayerModifyEffect extends GameplayEffect {
  constructor(private params: BuffLayerModifyParams) {
    super();
  }

  execute(context: EffectContext): void {
    for (const buff of findMatchingBuffs(context.target, this.params.match)) {
      const before = buff.getLayer();
      switch (this.params.operation) {
        case 'add':
          context.target.buffs.modifyBuffLayer(buff.id, Math.max(1, this.params.layers ?? 1));
          break;
        case 'subtract':
          context.target.buffs.modifyBuffLayer(buff.id, -Math.max(1, this.params.layers ?? 1));
          break;
        case 'clear':
          context.target.buffs.setBuffLayer(buff.id, 0);
          break;
        case 'set':
          context.target.buffs.setBuffLayer(buff.id, this.params.layers ?? 1);
          break;
      }

      publishMechanicLog({
        mechanic: 'buff_layer',
        source: context.caster,
        target: context.target,
        name: buff.name,
        value: before,
        detail: this.params.operation,
      });

      const repeat = this.params.scaleEffectsByLayer ? before : 1;
      for (let i = 0; i < repeat; i++) {
        executeEffectConfigs(this.params.effects ?? [], context);
      }
    }
  }
}

EffectRegistry.getInstance().register(
  'buff_layer_modify',
  (params) => new BuffLayerModifyEffect(params),
);
