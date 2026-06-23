import { ELEMENT_VALUES, type ElementType } from '@shared/types/constants';
import { ELEMENT_TO_MATERIAL_TAG } from '../../config/CreationMappings';
import { AFFIX_STOP_REASONS, AffixCandidate } from '../../types';
import { Rule } from '../core';
import { AffixSelectionDecision, AffixSelectionFacts } from '../contracts';

const MIXED_ARCHETYPE = 'mixed-elements';

export class GongfaSchoolPlanRules
  implements Rule<AffixSelectionFacts, AffixSelectionDecision>
{
  readonly id = 'affix.selection.gongfa-school-plan';

  apply({ facts, decision }: Parameters<Rule<AffixSelectionFacts, AffixSelectionDecision>['apply']>[0]): void {
    if (facts.productType !== 'gongfa') {
      return;
    }

    let accepted = [...decision.candidatePool];
    accepted = this.applyIdentityPriority(accepted, facts, decision);
    accepted = this.applyResonanceCompatibility(accepted, facts, decision);

    decision.candidatePool = accepted;
    decision.trace.push({
      ruleId: this.id,
      outcome: 'applied',
      message: `功法 slot 兼容过滤完成：${accepted.length} 个词缀通过`,
      details: {
        currentSlot: facts.currentSlot,
        selectedGongfaSchoolPlan: facts.selectedGongfaSchoolPlan,
      },
    });
  }

  private applyIdentityPriority(
    candidates: AffixCandidate[],
    facts: AffixSelectionFacts,
    decision: AffixSelectionDecision,
  ): AffixCandidate[] {
    if (!facts.currentSlot.slots.includes('identity')) {
      return candidates;
    }

    const identityCandidates = candidates.filter(
      (candidate) => candidate.slot === 'identity',
    );
    if (identityCandidates.length === 0) {
      return candidates;
    }

    const inputElements = this.inputElements(facts);
    const mixedIdentity = identityCandidates.find(
      (candidate) =>
        candidate.selectionMeta?.gongfa?.archetype === MIXED_ARCHETYPE,
    );
    if (mixedIdentity && inputElements.size >= 3) {
      for (const candidate of candidates) {
        if (candidate.id !== mixedIdentity.id) {
          this.reject(candidate, decision);
        }
      }
      return [mixedIdentity];
    }

    const biasedIdentity = facts.elementBias
      ? identityCandidates.filter(
          (candidate) =>
            candidate.selectionMeta?.gongfa?.element === facts.elementBias,
        )
      : [];
    const preferred =
      biasedIdentity.length > 0 ? biasedIdentity : identityCandidates;

    for (const candidate of candidates) {
      if (!preferred.includes(candidate)) {
        this.reject(candidate, decision);
      }
    }

    return preferred;
  }

  private applyResonanceCompatibility(
    candidates: AffixCandidate[],
    facts: AffixSelectionFacts,
    decision: AffixSelectionDecision,
  ): AffixCandidate[] {
    return candidates.filter((candidate) => {
      if (candidate.slot !== 'resonance') {
        return true;
      }

      if (this.isResonanceCompatible(candidate, facts)) {
        return true;
      }

      this.reject(candidate, decision);
      return false;
    });
  }

  private isResonanceCompatible(
    candidate: AffixCandidate,
    facts: AffixSelectionFacts,
  ): boolean {
    const meta = candidate.selectionMeta?.gongfa;
    const resonanceElements =
      meta?.resonanceElements ?? (meta?.element ? [meta.element] : []);

    if (resonanceElements.length === 0) {
      return true;
    }

    const inputElements = this.inputElements(facts);
    const primaryElement = facts.selectedGongfaSchoolPlan?.primaryElement;

    if (primaryElement) {
      return (
        resonanceElements.includes(primaryElement) &&
        resonanceElements.some(
          (element) => element !== primaryElement && inputElements.has(element),
        )
      );
    }

    if (inputElements.size === 0) {
      return false;
    }

    return resonanceElements.every((element) => inputElements.has(element));
  }

  private inputElements(facts: AffixSelectionFacts): Set<ElementType> {
    const tags = new Set(facts.inputTags);
    const elements = new Set<ElementType>();

    for (const element of ELEMENT_VALUES) {
      if (tags.has(ELEMENT_TO_MATERIAL_TAG[element])) {
        elements.add(element);
      }
    }

    return elements;
  }

  private reject(
    candidate: AffixCandidate,
    decision: AffixSelectionDecision,
  ): void {
    decision.rejections.push({
      affixId: candidate.id,
      amount: candidate.energyCost,
      reason: AFFIX_STOP_REASONS.SLOT_INCOMPATIBLE,
      ...(candidate.exclusiveGroup
        ? { exclusiveGroup: candidate.exclusiveGroup }
        : {}),
    });
    decision.trace.push({
      ruleId: this.id,
      outcome: 'blocked',
      message: '词缀因功法 slot 规划被过滤',
      details: {
        affixId: candidate.id,
        slot: candidate.slot,
        gongfaSelectionMeta: candidate.selectionMeta?.gongfa,
      },
    });
  }
}
