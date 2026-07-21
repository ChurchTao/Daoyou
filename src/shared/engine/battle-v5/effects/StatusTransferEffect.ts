import type { StatusTransferParams } from '../core/configs';
import { BuffType } from '../core/types';
import { EffectRegistry } from '../factories/EffectRegistry';
import type { Unit } from '../units/Unit';
import type { EffectContext } from './Effect';
import { GameplayEffect } from './Effect';
import { executeEffectConfigs } from '../core/effectExecutor';

export class StatusTransferEffect extends GameplayEffect {
  constructor(private readonly params: StatusTransferParams) {
    super();
  }

  execute(context: EffectContext): void {
    const from = this.unit(context, this.params.from);
    const to = this.params.to ? this.unit(context, this.params.to) : undefined;
    const matches = from.buffs.getAllBuffs().filter((buff) =>
      buff.dispelPolicy === 'normal' &&
      (this.params.status === 'positive'
        ? buff.type === BuffType.BUFF
        : buff.type === BuffType.DEBUFF || buff.type === BuffType.CONTROL),
    );
    const max = Math.max(1, Math.trunc(this.params.maxCount ?? 1));
    const selected = matches.slice(0, max);
    if (selected.length === 0) {
      executeEffectConfigs(this.params.fallbackEffects ?? [], context);
      return;
    }
    for (const buff of selected) {
      const moved = buff.clone();
      const source = buff.getSource();
      if (!from.buffs.removeBuffDispel(buff.id)) continue;
      if (this.params.operation === 'move' && to) {
        to.buffs.addBuff(moved, source ?? undefined, { ability: context.ability });
      }
      executeEffectConfigs(this.params.effects ?? [], context);
    }
  }

  private unit(context: EffectContext, side: 'caster' | 'target'): Unit {
    return side === 'caster' ? context.caster : context.target;
  }
}

EffectRegistry.getInstance().register(
  'status_transfer',
  (params) => new StatusTransferEffect(params),
);
