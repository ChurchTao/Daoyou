import type { MechanicLogParams } from '../core/configs';
import { EffectRegistry } from '../factories/EffectRegistry';
import { publishMechanicLog } from './advancedEffectUtils';
import { EffectContext, GameplayEffect } from './Effect';

/** 内容层发布通用具名机制与状态迁移，不接触日志聚合和渲染器。 */
export class MechanicLogEffect extends GameplayEffect {
  constructor(private readonly params: MechanicLogParams) {
    super();
  }

  execute(context: EffectContext): void {
    publishMechanicLog({
      mechanic: this.params.mechanic,
      source: context.caster,
      ability: context.ability,
      sourceBuff: context.buff,
      target:
        this.params.target === 'caster' ? context.caster : context.target,
      name: this.params.internalKey,
      internalKey: this.params.internalKey,
      displayName: this.params.displayName,
      visibility: this.params.visibility ?? 'player',
      operation: this.params.operation,
      previousDisplayName: this.params.previousDisplayName,
      triggerBasis: this.params.triggerBasis,
    });
  }
}

EffectRegistry.getInstance().register(
  'mechanic_log',
  (params) => new MechanicLogEffect(params),
);
