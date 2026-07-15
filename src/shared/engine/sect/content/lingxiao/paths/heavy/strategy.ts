import type {
  AbilitySelectionContext,
  AbilitySelectionResult,
  AbilitySelectionStrategy,
} from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import { SectStrategyCandidates, type SectTacticId } from '../../../../core';
import { LINGXIAO_SECT_ID } from '../../ids';
import { LINGXIAO_SWORD_MOMENTUM } from '../../shared/LingxiaoMechanics';

export class LingxiaoHeavySelectionStrategy implements AbilitySelectionStrategy {
  constructor(private readonly tacticId: SectTacticId) {}

  select(context: AbilitySelectionContext): AbilitySelectionResult | null {
    const { caster, opponent, candidates } = context;
    if (!opponent || candidates.length === 0) return null;
    const index = new SectStrategyCandidates(LINGXIAO_SECT_ID, candidates);
    const momentum = caster.combatResources.getCurrent(LINGXIAO_SWORD_MOMENTUM);
    const buffs = new Set(caster.buffs.getAllBuffIds());
    const finisherThreshold = this.tacticId === 'heavy-break' ? 3 : this.tacticId === 'heavy-guard' ? 5 : 6;

    const mountainStep = index.find('shadow-step');
    if (
      this.tacticId === 'heavy-guard' &&
      mountainStep &&
      caster.getCurrentShield() <= 0
    ) {
      return index.resultForCandidate(mountainStep, 650);
    }
    const heart = index.find('sword-aegis');
    if (heart && !buffs.has('sect.lingxiao.heavy.mountain-heart') && caster.getHpPercent() < 0.65) {
      return index.resultForCandidate(heart, 620);
    }
    const hidden = index.find('turning-body');
    if (hidden && this.tacticId === 'heavy-break' && !buffs.has('sect.lingxiao.heavy.hidden-edge')) {
      return index.resultForCandidate(hidden, 590);
    }
    const finisher = index.find('sect-ultimate');
    if (finisher && momentum >= finisherThreshold) {
      return index.resultForCandidate(finisher, opponent.getHpPercent() < 0.25 ? 570 : 520);
    }
    const heavyIntent = index.find('nurturing-sword');
    if (heavyIntent && !buffs.has('sect.lingxiao.heavy.weightless-edge')) {
      return index.resultForCandidate(heavyIntent, 400);
    }
    const sinking = index.find('linked-edge');
    if (sinking) return index.resultForCandidate(sinking, 360);
    return index.resultForCandidate(index.find('guiding-sword') ?? candidates[0], 100);
  }
}
