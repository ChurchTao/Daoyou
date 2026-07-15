import { AbilityType } from '../core/types';
import type { QueueActionParams } from '../core/configs';
import { setQueuedAction } from '../core/runtimeState';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';

export class QueueActionEffect extends GameplayEffect {
  constructor(private readonly params: QueueActionParams) {
    super();
  }

  execute(context: EffectContext): void {
    setQueuedAction(context.caster, {
      slug: this.params.id,
      name: this.params.name,
      type: AbilityType.ACTIVE_SKILL,
      tags: this.params.tags,
      mpCost: 0,
      cooldown: 0,
      targetPolicy: this.params.targetPolicy ?? { team: 'enemy', scope: 'single' },
      effects: this.params.effects,
    }, this.params.cancelEffects);
  }
}

EffectRegistry.getInstance().register('queue_action', (params) => new QueueActionEffect(params));
