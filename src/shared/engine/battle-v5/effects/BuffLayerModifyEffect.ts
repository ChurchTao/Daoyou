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
    const unit = this.params.target === 'caster' ? context.caster : context.target;
    const origin = {
      source: context.caster,
      ability: context.ability,
      buff: context.buff,
    };
    for (const buff of findMatchingBuffs(unit, this.params.match)) {
      const before = buff.getLayer();
      switch (this.params.operation) {
        case 'add':
          unit.buffs.modifyBuffLayer(buff.id, Math.max(1, this.params.layers ?? 1), origin);
          break;
        case 'subtract':
          unit.buffs.modifyBuffLayer(buff.id, -Math.max(1, this.params.layers ?? 1), origin);
          break;
        case 'clear':
          unit.buffs.setBuffLayer(buff.id, 0, origin);
          break;
        case 'set':
          unit.buffs.setBuffLayer(buff.id, this.params.layers ?? 1, origin);
          break;
      }

      publishMechanicLog({
        mechanic: 'buff_layer',
        source: context.caster,
        ability: context.ability,
        sourceBuff: context.buff,
        target: unit,
        name: buff.name,
        displayName: buff.name,
        visibility: this.params.logVisibility ?? 'player',
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
