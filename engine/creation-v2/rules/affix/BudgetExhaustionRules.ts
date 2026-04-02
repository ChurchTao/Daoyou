import { AFFIX_STOP_REASONS } from '../../types';
import { Rule } from '../core';
import { AffixSelectionDecision, AffixSelectionFacts } from '../contracts';

export class BudgetExhaustionRules
  implements Rule<AffixSelectionFacts, AffixSelectionDecision>
{
  readonly id = 'affix.selection.budget';

  apply({ facts, decision, diagnostics }: Parameters<Rule<AffixSelectionFacts, AffixSelectionDecision>['apply']>[0]): void {
    const accepted = [] as AffixSelectionDecision['candidatePool'];

    for (const candidate of decision.candidatePool) {
      if (candidate.energyCost > facts.remainingEnergy) {
        decision.rejections.push({
          affixId: candidate.id,
          amount: candidate.energyCost,
          reason: AFFIX_STOP_REASONS.BUDGET_EXHAUSTED,
          ...(candidate.exclusiveGroup
            ? { exclusiveGroup: candidate.exclusiveGroup }
            : {}),
        });
        diagnostics.addTrace({
          ruleId: this.id,
          outcome: 'blocked',
          message: '词缀因预算不足被过滤',
          details: {
            affixId: candidate.id,
            remainingEnergy: facts.remainingEnergy,
            energyCost: candidate.energyCost,
          },
        });
        continue;
      }

      accepted.push(candidate);
    }

    decision.candidatePool = accepted;

    diagnostics.addTrace({
      ruleId: this.id,
      outcome: 'applied',
      message: `预算过滤完成：${accepted.length} 个词缀通过，剩余能量 ${facts.remainingEnergy}`,
    });
  }
}