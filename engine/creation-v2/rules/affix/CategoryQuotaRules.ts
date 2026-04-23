import { AFFIX_STOP_REASONS } from '../../types';
import { Rule } from '../core';
import { AffixSelectionDecision, AffixSelectionFacts } from '../contracts';

/*
 * CategoryQuotaRules: 控制非 core 词缀的分类配额，避免抽签结果过度集中在单一类别。
 */
export class CategoryQuotaRules
  implements Rule<AffixSelectionFacts, AffixSelectionDecision>
{
  readonly id = 'affix.selection.category-quota';

  apply({ facts, decision }: Parameters<Rule<AffixSelectionFacts, AffixSelectionDecision>['apply']>[0]): void {
    const accepted = [] as AffixSelectionDecision['candidatePool'];

    for (const candidate of decision.candidatePool) {
      const cap = facts.selectionConstraints.categoryCaps[candidate.category] ?? 0;

      const current = facts.selectedCategoryCounts[candidate.category] ?? 0;
      if (current >= cap) {
        decision.rejections.push({
          affixId: candidate.id,
          amount: candidate.energyCost,
          reason: AFFIX_STOP_REASONS.CATEGORY_QUOTA_REACHED,
          ...(candidate.exclusiveGroup
            ? { exclusiveGroup: candidate.exclusiveGroup }
            : {}),
        });
        decision.trace.push({
          ruleId: this.id,
          outcome: 'blocked',
          message: '词缀因分类配额上限被过滤',
          details: {
            affixId: candidate.id,
            category: candidate.category,
            current,
            cap,
          },
        });
        continue;
      }

      accepted.push(candidate);
    }

    decision.candidatePool = accepted;

    decision.trace.push({
      ruleId: this.id,
      outcome: 'applied',
      message: `分类配额过滤完成：${accepted.length} 个词缀通过`,
    });
  }
}
