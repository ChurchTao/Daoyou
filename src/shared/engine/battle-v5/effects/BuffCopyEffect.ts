import { StackRule } from '../buffs/Buff';
import { BuffCopyParams } from '../core/configs';
import { BuffAddEvent } from '../core/events';
import {
  beginRuntimeGuard,
  endRuntimeGuard,
  getBattleRuntimeState,
  readRecentRemovedBuff,
} from '../core/runtimeState';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';
import { findMatchingBuffs, matchesBuff } from './advancedEffectUtils';

export class BuffCopyEffect extends GameplayEffect {
  constructor(private params: BuffCopyParams) {
    super();
  }

  execute(context: EffectContext): void {
    const buffAddEvent =
      context.triggerEvent?.type === 'BuffAddEvent'
        ? (context.triggerEvent as BuffAddEvent)
        : undefined;
    const eventBuff = buffAddEvent?.buff;
    let sourceBuff = this.params.replayRemoved
      ? readRecentRemovedBuff(context.target, (buff) =>
          matchesBuff(buff, this.params.match),
        )
      : undefined;

    if (!this.params.replayRemoved) {
      sourceBuff =
        eventBuff && matchesBuff(eventBuff, this.params.match)
          ? eventBuff
          : findMatchingBuffs(context.target, this.params.match)[0];
    }
    if (!sourceBuff) return;

    const triggerOwner = context.caster;
    const triggerKey = `buff_copy:${context.ability?.id ?? 'effect'}:${this.params.id ?? sourceBuff.id}`;
    const state = getBattleRuntimeState(triggerOwner);
    const maxTriggers = this.params.maxTriggers;
    if (maxTriggers !== undefined && (state.counters.get(triggerKey) ?? 0) >= maxTriggers) {
      return;
    }

    const cloned = sourceBuff.clone();
    if (this.params.durationDelta && cloned.getMaxDuration() > 0) {
      cloned.refreshToDuration(Math.max(1, cloned.getMaxDuration() + this.params.durationDelta));
    }
    const receiver = this.params.target === 'target' ? context.target : context.caster;
    if (maxTriggers !== undefined) {
      state.counters.set(triggerKey, (state.counters.get(triggerKey) ?? 0) + 1);
    }

    if (buffAddEvent?.target === receiver && eventBuff?.id === sourceBuff.id) {
      if (this.params.durationDelta && sourceBuff.getMaxDuration() > 0) {
        sourceBuff.refreshToDuration(
          Math.max(1, sourceBuff.getMaxDuration() + this.params.durationDelta),
        );
      } else if (sourceBuff.stackRule === StackRule.STACK_LAYER) {
        sourceBuff.addLayer(1);
      }
      return;
    }

    const copyKey = `buff_copy:in_progress:${sourceBuff.id}`;
    if (!beginRuntimeGuard(receiver, copyKey)) {
      return;
    }
    try {
      receiver.buffs.addBuff(cloned, context.caster);
    } finally {
      endRuntimeGuard(receiver, copyKey);
    }
  }
}

EffectRegistry.getInstance().register(
  'buff_copy',
  (params) => new BuffCopyEffect(params),
);
