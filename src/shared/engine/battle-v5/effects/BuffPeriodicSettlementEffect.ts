import { DataDrivenBuff } from '../buffs/DataDrivenBuff';
import type { BuffPeriodicSettlementParams } from '../core/configs';
import { executeEffectConfigs } from '../core/effectExecutor';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';
import { findMatchingBuffs } from './advancedEffectUtils';

/** 以原 Buff、原施术者和原周期效果手动结算指定持续状态。 */
export class BuffPeriodicSettlementEffect extends GameplayEffect {
  constructor(private readonly params: BuffPeriodicSettlementParams) {
    super();
  }

  execute(context: EffectContext): void {
    const unit = this.params.target === 'caster' ? context.caster : context.target;
    const buff = findMatchingBuffs(unit, this.params.match).find((candidate) =>
      (this.params.source ?? 'caster') === 'any' ||
      candidate.getSource() === context.caster,
    );
    if (!(buff instanceof DataDrivenBuff)) return;

    const effects = buff.getConfig().manualSettlementEffects ?? [];
    if (effects.length === 0) return;
    const repeats = this.params.mode === 'remaining_remove'
      ? Math.max(0, buff.getDuration())
      : 1;
    const source = buff.getSource() ?? context.caster;
    for (let index = 0; index < repeats && unit.isAlive(); index += 1) {
      executeEffectConfigs(effects, {
        caster: source,
        target: unit,
        buff,
        damageCause: this.params.cause,
      });
    }

    if (this.params.mode === 'remaining_remove') {
      unit.buffs.removeBuff(buff.id);
    }
  }
}

EffectRegistry.getInstance().register(
  'buff_periodic_settlement',
  (params) => new BuffPeriodicSettlementEffect(params),
);
