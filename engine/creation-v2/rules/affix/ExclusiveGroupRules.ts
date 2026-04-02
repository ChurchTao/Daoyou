import { AFFIX_STOP_REASONS } from '../../types';
import { Rule } from '../core';
import { AffixSelectionDecision, AffixSelectionFacts } from '../contracts';

export class ExclusiveGroupRules
  implements Rule<AffixSelectionFacts, AffixSelectionDecision>
{
  readonly id = 'affix.selection.exclusive-group';

  apply({ facts, decision, diagnostics }: Parameters<Rule<AffixSelectionFacts, AffixSelectionDecision>['apply']>[0]): void {
    const accepted = [] as AffixSelectionDecision['candidatePool'];

    for (const candidate of decision.candidatePool) {
      if (
        candidate.exclusiveGroup &&
        facts.selectedExclusiveGroups.includes(candidate.exclusiveGroup)
      ) {
        decision.rejections.push({
          affixId: candidate.id,
          amount: candidate.energyCost,
          reason: AFFIX_STOP_REASONS.EXCLUSIVE_GROUP_CONFLICT,
          exclusiveGroup: candidate.exclusiveGroup,
        });
        diagnostics.addTrace({
          ruleId: this.id,
          outcome: 'blocked',
          message: '词缀因 exclusive group 冲突被过滤',
          details: {
            affixId: candidate.id,
            exclusiveGroup: candidate.exclusiveGroup,
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
      message: `exclusive-group 过滤完成：${accepted.length} 个词缀通过，${decision.rejections.length} 个被过滤`,
    });
  }
}