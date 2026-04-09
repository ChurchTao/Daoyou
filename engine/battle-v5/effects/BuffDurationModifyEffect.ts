import { BuffDurationModifyParams } from '../core/configs';
import { BuffAddEvent } from '../core/events';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';

/**
 * BUFF 持续时间扰动效果
 * 用于在 BuffAddEvent 上延长符合条件的正面/负面状态持续时间。
 */
export class BuffDurationModifyEffect extends GameplayEffect {
  constructor(private params: BuffDurationModifyParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { triggerEvent } = context;

    if (!triggerEvent || triggerEvent.type !== 'BuffAddEvent') {
      return;
    }

    const buffAddEvent = triggerEvent as BuffAddEvent;
    const targetBuff = buffAddEvent.buff;

    if (targetBuff.isPermanent()) {
      return;
    }

    if (
      this.params.tags &&
      this.params.tags.length > 0 &&
      !targetBuff.tags.hasAnyTag(this.params.tags)
    ) {
      return;
    }

    const nextDuration = Math.max(1, targetBuff.getMaxDuration() + this.params.rounds);
    targetBuff.refreshToDuration(nextDuration);
  }
}

EffectRegistry.getInstance().register(
  'buff_duration_modify',
  (params) => new BuffDurationModifyEffect(params),
);