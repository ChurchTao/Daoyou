import type {
  AbilitySelectionContext,
  AbilitySelectionResult,
  AbilitySelectionStrategy,
} from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import { AttributeType } from '@shared/engine/battle-v5/core/types';
import { SectStrategyCandidates, type SectTacticId } from '../../../../core';
import { LINGXIAO_SECT_ID } from '../../ids';
import { LINGXIAO_RETURNING_SWALLOW_BUFF, LINGXIAO_SWORD_MOMENTUM } from '../../shared/LingxiaoMechanics';

export class LingxiaoSwiftSelectionStrategy implements AbilitySelectionStrategy {
  constructor(private readonly tacticId: SectTacticId) {}

  select(context: AbilitySelectionContext): AbilitySelectionResult | null {
    const { caster, opponent, candidates } = context;
    if (!opponent || candidates.length === 0) return null;
    const index = new SectStrategyCandidates(LINGXIAO_SECT_ID, candidates);
    const momentum = caster.combatResources.getCurrent(LINGXIAO_SWORD_MOMENTUM);
    const finisherThreshold = this.tacticId === 'aggressive' ? 3 : this.tacticId === 'counter' ? 5 : 6;
    const buffs = new Set(caster.buffs.getAllBuffIds());

    const turning = index.find('turning-body');
    if (this.tacticId === 'counter' && turning && !buffs.has(LINGXIAO_RETURNING_SWALLOW_BUFF)) {
      return index.resultForCandidate(turning, 620);
    }
    const heart = index.find('sword-aegis');
    if (heart && !buffs.has('sect.lingxiao.swift.wind-heart') && caster.getHpPercent() < 0.6) {
      return index.resultForCandidate(heart, 580);
    }
    const finisher = index.find('sect-ultimate');
    if (finisher && momentum >= finisherThreshold) {
      return index.resultForCandidate(finisher, opponent.getHpPercent() < 0.25 ? 560 : 500);
    }
    const linked = index.find('linked-edge');
    if (linked) return index.resultForCandidate(linked, 400);

    const lightBuff = index.find('nurturing-sword');
    if (lightBuff && !buffs.has('sect.lingxiao.swift.light-sword')) {
      return index.resultForCandidate(lightBuff, 340);
    }
    const step = index.find('shadow-step');
    if (
      step &&
      !buffs.has('sect.lingxiao.swift.traceless-step') &&
      caster.attributes.getValue(AttributeType.SPEED) <= opponent.attributes.getValue(AttributeType.SPEED)
    ) {
      return index.resultForCandidate(step, 320);
    }
    return index.resultForCandidate(index.find('guiding-sword') ?? candidates[0], 100);
  }
}
