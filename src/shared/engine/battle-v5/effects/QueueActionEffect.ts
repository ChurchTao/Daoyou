import { AbilityType } from '../core/types';
import type { QueueActionParams } from '../core/configs';
import { setQueuedAction } from '../core/runtimeState';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';
import { EventBus } from '../core/EventBus';
import type { ActionStateEvent } from '../core/events';

export class QueueActionEffect extends GameplayEffect {
  constructor(private readonly params: QueueActionParams) {
    super();
  }

  execute(context: EffectContext): void {
    const abilityConfig = {
      slug: this.params.id,
      name: this.params.name,
      type: AbilityType.ACTIVE_SKILL,
      tags: this.params.tags,
      mpCost: 0,
      cooldown: 0,
      targetPolicy: this.params.targetPolicy ?? { team: 'enemy', scope: 'single' },
      effects: this.params.effects,
    } as const;
    const sourceAbility = context.ability
      ? { id: context.ability.id, name: context.ability.name }
      : undefined;
    setQueuedAction(context.caster, abilityConfig, {
      sourceAbility,
      cancelEffects: this.params.cancelEffects,
      interruptPolicy: this.params.interruptPolicy,
      hitPolicy: this.params.hitPolicy,
    });
    EventBus.instance.publish<ActionStateEvent>({
      type: 'ActionStateEvent',
      timestamp: Date.now(),
      unit: context.caster,
      stateType: 'queued_action',
      phase: 'entered',
      name: '蓄势',
      remainingActions: 1,
      sourceAbility,
      ability: { id: abilityConfig.slug, name: abilityConfig.name },
    });
  }
}

EffectRegistry.getInstance().register('queue_action', (params) => new QueueActionEffect(params));
