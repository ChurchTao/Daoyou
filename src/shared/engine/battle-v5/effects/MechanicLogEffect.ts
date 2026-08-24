import type { MechanicLogParams } from '../core/configs';
import { EffectRegistry } from '../factories/EffectRegistry';
import { commitMechanicResultV3 } from './advancedEffectUtils';
import { EffectExecutionContextV3, GameplayEffect } from './Effect';

/** 内容层发布通用具名机制与状态迁移，不接触日志聚合和渲染器。 */
export class MechanicLogEffect extends GameplayEffect {
  constructor(private readonly params: MechanicLogParams) {
    super();
  }

  execute(context: EffectExecutionContextV3): void {
    commitMechanicResultV3(context, {
      code: this.params.internalKey,
      target: this.params.target === 'caster' ? context.caster : context.target,
      visibility: this.params.visibility ?? 'player',
      payload:
        this.params.mechanic === 'named_trigger'
          ? {
              kind: 'named_trigger',
              label: this.params.displayName,
              description: this.params.description,
            }
          : {
              kind: 'status_transition',
              label: this.params.displayName,
              operation: this.params.operation ?? 'apply',
              previousLabel: this.params.previousDisplayName,
            },
    });
  }
}

EffectRegistry.getInstance().register(
  'mechanic_log',
  (params) => new MechanicLogEffect(params),
);
