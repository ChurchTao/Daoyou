import { QUALITY_ORDER } from '@/types/constants';
import { Rule } from '../core';
import { AffixEligibilityFacts, AffixPoolDecision } from '../contracts';

/*
 * AffixEligibilityRules: 对候选词缀进行品质/适用性判断，过滤不满足 minQuality/maxQuality 的词缀并记录 rejectedCandidates。
 */
export class AffixEligibilityRules
  implements Rule<AffixEligibilityFacts, AffixPoolDecision>
{
  readonly id = 'affix.pool.eligibility';

  apply({ facts, decision, diagnostics }: Parameters<Rule<AffixEligibilityFacts, AffixPoolDecision>['apply']>[0]): void {
    const accepted = [] as AffixPoolDecision['candidates'];

    for (const candidate of facts.candidatePool) {
      if (
        candidate.minQuality !== undefined &&
        facts.maxQualityOrder < QUALITY_ORDER[candidate.minQuality]
      ) {
        decision.rejectedCandidates.push({
          affixId: candidate.id,
          reason: 'min_quality_unmet',
          category: candidate.category,
        });
        diagnostics.addTrace({
          ruleId: this.id,
          outcome: 'blocked',
          message: '词缀因材料品质不足被过滤',
          details: {
            affixId: candidate.id,
            minQuality: candidate.minQuality,
          },
        });
        continue;
      }

      if (
        candidate.maxQuality !== undefined &&
        facts.maxQualityOrder > QUALITY_ORDER[candidate.maxQuality]
      ) {
        decision.rejectedCandidates.push({
          affixId: candidate.id,
          reason: 'max_quality_exceeded',
          category: candidate.category,
        });
        diagnostics.addTrace({
          ruleId: this.id,
          outcome: 'blocked',
          message: '词缀因材料品质超出上限被过滤',
          details: {
            affixId: candidate.id,
            maxQuality: candidate.maxQuality,
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
      message: '完成候选资格过滤',
      details: {
        accepted: accepted.length,
        rejected: decision.rejectedCandidates.length,
      },
    });
  }
}