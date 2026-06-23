import { AFFIX_STOP_REASONS } from '../../types';
import { Rule } from '../core';
import { AffixSelectionDecision, AffixSelectionFacts } from '../contracts';

export class SlotCompatibilityRules
  implements Rule<AffixSelectionFacts, AffixSelectionDecision>
{
  readonly id = 'affix.selection.slot';

  apply({ facts, decision }: Parameters<Rule<AffixSelectionFacts, AffixSelectionDecision>['apply']>[0]): void {
    const accepted = [] as AffixSelectionDecision['candidatePool'];

    for (const candidate of decision.candidatePool) {
      if (facts.currentSlot.slots.includes(candidate.slot)) {
        accepted.push(candidate);
        continue;
      }

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
        message: '词缀不属于当前开放 slot，已过滤',
        details: {
          affixId: candidate.id,
          candidateSlot: candidate.slot,
          allowedSlots: facts.currentSlot.slots,
          slotIndex: facts.currentSlot.index,
        },
      });
    }

    decision.candidatePool = accepted;
    decision.trace.push({
      ruleId: this.id,
      outcome: 'applied',
      message: `slot 兼容过滤完成：${accepted.length} 个词缀通过`,
      details: {
        currentSlot: facts.currentSlot,
      },
    });
  }
}
