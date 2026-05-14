import { BuffImmunityParams } from '../core/configs';
import { EventBus } from '../core/EventBus';
import { BuffAddEvent, BuffImmuneEvent } from '../core/events';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';

/**
 * BUFF 免疫原子效果
 */
export class BuffImmunityEffect extends GameplayEffect {
  constructor(private readonly params: BuffImmunityParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { triggerEvent, target } = context;
    if (!triggerEvent || triggerEvent.type !== 'BuffAddEvent') {
      return;
    }

    const event = triggerEvent as BuffAddEvent;
    if (event.isCancelled) {
      return;
    }

    const matchedTag = this.params.tags.find((tag) => event.buff.tags.hasTag(tag));
    if (!matchedTag) {
      return;
    }

    event.isCancelled = true;
    event.immuneTag = matchedTag;

    EventBus.instance.publish<BuffImmuneEvent>({
      type: 'BuffImmuneEvent',
      timestamp: Date.now(),
      target,
      buff: event.buff,
      immuneTag: matchedTag,
    });
  }
}

EffectRegistry.getInstance().register(
  'buff_immunity',
  (params) => new BuffImmunityEffect(params),
);