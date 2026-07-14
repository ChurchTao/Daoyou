import type {
  AbilitySelectionContext,
  AbilitySelectionResult,
  AbilitySelectionStrategy,
} from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import { AttributeType } from '@shared/engine/battle-v5/core/types';
import { SectStrategyCandidates, type SectTacticId } from '../../../../core';
import { LINGXIAO_SECT_ID } from '../../ids';
import {
  LINGXIAO_RETURNING_SWALLOW_BUFF,
  LINGXIAO_SHADOW_STEP_BUFF,
  LINGXIAO_SWORD_MARK_BUFF,
  LINGXIAO_SWORD_MOMENTUM,
} from '../../shared/LingxiaoMechanics';

export class LingxiaoSwiftSelectionStrategy implements AbilitySelectionStrategy {
  constructor(private readonly tacticId: SectTacticId) {}

  select(context: AbilitySelectionContext): AbilitySelectionResult | null {
    const { caster, opponent, candidates } = context;
    if (!opponent || !candidates.length) return null;
    const index = new SectStrategyCandidates(LINGXIAO_SECT_ID, candidates);
    const thresholds =
      this.tacticId === 'aggressive'
        ? { finisher: 3, aegis: 0.25, turning: 0.35 }
        : this.tacticId === 'counter'
          ? { finisher: 5, aegis: 0.45, turning: 0.7 }
          : { finisher: 6, aegis: 0.4, turning: 0.55 };
    const momentum = caster.combatResources.getCurrent(LINGXIAO_SWORD_MOMENTUM);
    const hasMark = opponent.buffs
      .getAllBuffIds()
      .includes(LINGXIAO_SWORD_MARK_BUFF);
    const aegis = index.find('sword-aegis');
    if (
      aegis &&
      caster.getCurrentShield() <= 0 &&
      caster.getHpPercent() < thresholds.aegis
    )
      return index.resultForCandidate(aegis, 600);
    const turning = index.find('turning-body');
    if (
      turning &&
      !caster.buffs.getAllBuffIds().includes(LINGXIAO_RETURNING_SWALLOW_BUFF) &&
      caster.getHpPercent() < thresholds.turning
    )
      return index.resultForCandidate(turning, 550);
    const breaking = index.find('breaking-edge');
    const ultimate = index.find('sect-ultimate');
    if (momentum >= thresholds.finisher) {
      if (opponent.getHpPercent() < 0.25 && breaking)
        return index.resultForCandidate(breaking, 500);
      if (momentum >= 6 && ultimate && !hasMark)
        return index.resultForCandidate(ultimate, 460);
      if (breaking) return index.resultForCandidate(breaking, 450);
      if (ultimate) return index.resultForCandidate(ultimate, 440);
    }
    const linked = index.find('linked-edge');
    if (!hasMark && linked) return index.resultForCandidate(linked, 350);
    const guiding = index.find('guiding-sword');
    const shadow = index.find('shadow-step');
    const shouldShadow =
      shadow &&
      !caster.buffs.getAllBuffIds().includes(LINGXIAO_SHADOW_STEP_BUFF) &&
      caster.attributes.getValue(AttributeType.SPEED) <=
        opponent.attributes.getValue(AttributeType.SPEED) &&
      momentum <= 2;
    if (shouldShadow) return index.resultForCandidate(shadow, 300);
    return index.resultForCandidate(
      guiding ?? linked ?? shadow ?? candidates[0],
      100,
    );
  }
}
