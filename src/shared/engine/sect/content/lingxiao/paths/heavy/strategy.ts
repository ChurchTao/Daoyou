import type {
  AbilitySelectionContext,
  AbilitySelectionResult,
  AbilitySelectionStrategy,
} from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import { SectStrategyCandidates, type SectTacticId } from '../../../../core';
import { LINGXIAO_SECT_ID } from '../../ids';
import {
  LINGXIAO_ARMOR_REND_BUFF,
  LINGXIAO_HEAVY_GUARD_BUFF,
  LINGXIAO_HEAVY_POSTURE,
} from '../../shared/LingxiaoMechanics';

export class LingxiaoHeavySelectionStrategy implements AbilitySelectionStrategy {
  constructor(private readonly tacticId: SectTacticId) {}

  select(context: AbilitySelectionContext): AbilitySelectionResult | null {
    const { caster, opponent, candidates } = context;
    if (!opponent || !candidates.length) return null;
    const index = new SectStrategyCandidates(LINGXIAO_SECT_ID, candidates);
    const posture = caster.combatResources.getCurrent(LINGXIAO_HEAVY_POSTURE);
    const hasRend = opponent.buffs
      .getAllBuffIds()
      .includes(LINGXIAO_ARMOR_REND_BUFF);
    const guardThreshold = this.tacticId === 'heavy-guard' ? 0.7 : 0.45;
    const aegisThreshold = this.tacticId === 'heavy-guard' ? 0.55 : 0.35;
    const finisherThreshold =
      this.tacticId === 'heavy-break'
        ? 3
        : this.tacticId === 'heavy-guard'
          ? 5
          : 6;
    const turning = index.find('turning-body');
    const aegis = index.find('sword-aegis');
    if (
      this.tacticId === 'heavy-guard' &&
      aegis &&
      caster.getCurrentShield() <= 0 &&
      caster.getHpPercent() < aegisThreshold
    )
      return index.resultForCandidate(aegis, 620);
    if (
      turning &&
      caster.getHpPercent() < guardThreshold &&
      !caster.buffs.getAllBuffIds().includes(LINGXIAO_HEAVY_GUARD_BUFF)
    )
      return index.resultForCandidate(turning, 600);
    if (
      aegis &&
      caster.getCurrentShield() <= 0 &&
      caster.getHpPercent() < aegisThreshold
    )
      return index.resultForCandidate(aegis, 580);
    const ultimate = index.find('sect-ultimate');
    if (posture >= 6 && ultimate)
      return index.resultForCandidate(ultimate, 520);
    const breaking = index.find('breaking-edge');
    const linked = index.find('linked-edge');
    if (
      this.tacticId === 'heavy-break' &&
      opponent.getHpPercent() < 0.25 &&
      posture >= finisherThreshold &&
      breaking
    )
      return index.resultForCandidate(breaking, 510);
    if (!hasRend && linked) return index.resultForCandidate(linked, 380);
    if (posture >= finisherThreshold && breaking)
      return index.resultForCandidate(
        breaking,
        opponent.getHpPercent() < 0.25 ? 510 : 470,
      );
    const nurturing = index.find('nurturing-sword');
    if (nurturing && caster.getHpPercent() < 0.4)
      return index.resultForCandidate(nurturing, 360);
    return index.resultForCandidate(
      index.find('guiding-sword') ?? linked ?? candidates[0],
      100,
    );
  }
}
