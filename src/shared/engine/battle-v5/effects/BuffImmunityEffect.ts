import { BuffImmunityParams } from '../core/configs';
import { BuffAddEvent, BuffImmuneEvent } from '../core/events';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectExecutionContextV3, GameplayEffect } from './Effect';

/**
 * BUFF 免疫原子效果
 */
export class BuffImmunityEffect extends GameplayEffect {
  constructor(private readonly params: BuffImmunityParams) {
    super();
  }

  execute(context: EffectExecutionContextV3): void {
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

    context.commit(target, {
      type: 'status',
      operation: 'immune',
      statusId: event.buff.id,
      statusName: event.buff.name,
      statusType: event.buff.type,
    });

    context.emit<BuffImmuneEvent>({
      type: 'BuffImmuneEvent',
      timestamp: context.owner.runtime.clock.now(),
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
