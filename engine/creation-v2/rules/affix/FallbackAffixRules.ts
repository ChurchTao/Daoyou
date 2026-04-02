import { AFFIX_STOP_REASONS } from '../../types';
import { Rule } from '../core';
import { AffixSelectionDecision, AffixSelectionFacts } from '../contracts';

/*
 * FallbackAffixRules: 当候选池耗尽时确定停机原因（预算/互斥/数量/池耗尽）并写入 decision.exhaustionReason。
 */
export class FallbackAffixRules
  implements Rule<AffixSelectionFacts, AffixSelectionDecision>
{
  readonly id = 'affix.selection.fallback';

  apply({ facts, decision, diagnostics }: Parameters<Rule<AffixSelectionFacts, AffixSelectionDecision>['apply']>[0]): void {
    if (decision.candidatePool.length > 0) {
      diagnostics.addTrace({
        ruleId: this.id,
        outcome: 'applied',
        message: '仍存在可用候选，不触发停机回退',
      });
      return;
    }

    if (facts.selectionCount >= facts.maxSelections) {
      decision.exhaustionReason = AFFIX_STOP_REASONS.MAX_COUNT_REACHED;
    } else if (
      decision.rejections.some((rejection) => rejection.reason === AFFIX_STOP_REASONS.BUDGET_EXHAUSTED)
    ) {
      decision.exhaustionReason = AFFIX_STOP_REASONS.BUDGET_EXHAUSTED;
    } else if (
      decision.rejections.some(
        (rejection) => rejection.reason === AFFIX_STOP_REASONS.EXCLUSIVE_GROUP_CONFLICT,
      )
    ) {
      decision.exhaustionReason = AFFIX_STOP_REASONS.EXCLUSIVE_GROUP_CONFLICT;
    } else {
      decision.exhaustionReason = AFFIX_STOP_REASONS.POOL_EXHAUSTED;
    }

    diagnostics.addTrace({
      ruleId: this.id,
      outcome: 'applied',
      message: '已设置本轮 affix 停机原因',
      details: {
        exhaustionReason: decision.exhaustionReason,
      },
    });
  }
}