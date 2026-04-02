import { Rule } from '../core';
import { AffixEligibilityFacts, AffixPoolDecision } from '../contracts';

export class AffixWeightRules
  implements Rule<AffixEligibilityFacts, AffixPoolDecision>
{
  readonly id = 'affix.pool.weight';

  apply({ decision, diagnostics }: Parameters<Rule<AffixEligibilityFacts, AffixPoolDecision>['apply']>[0]): void {
    const accepted = [] as AffixPoolDecision['candidates'];

    for (const candidate of decision.candidates) {
      if (candidate.weight <= 0) {
        decision.rejectedCandidates.push({
          affixId: candidate.id,
          reason: 'non_positive_weight',
          category: candidate.category,
        });
        diagnostics.addWarning({
          code: 'affix_non_positive_weight',
          message: '检测到非正权重词缀，已跳过',
          details: {
            affixId: candidate.id,
            weight: candidate.weight,
          },
        });
        continue;
      }

      accepted.push(candidate);
    }

    decision.candidates = accepted;
    diagnostics.addTrace({
      ruleId: this.id,
      outcome: 'applied',
      message: '完成候选权重合法性过滤',
      details: {
        accepted: accepted.length,
      },
    });
  }
}