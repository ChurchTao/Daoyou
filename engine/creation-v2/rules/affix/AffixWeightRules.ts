import { Rule } from '../core';
import { AffixEligibilityFacts, AffixPoolDecision } from '../contracts';
import { CREATION_AFFIX_POOL_SCORING } from '../../config/CreationBalance';

/*
 * AffixWeightRules: 词缀候选池权重验证规则。
 * 过滤掉非正权重并记录警告，保证后续抽签器只处理合法权重的候选项。
 */
/*
 * AffixWeightRules: 计算候选词缀的权重（考虑 rarityWeight、category 优先级等），
 * 为后续 Picker 的加权抽样提供权重表并记录 diagnostics。
 */
export class AffixWeightRules
  implements Rule<AffixEligibilityFacts, AffixPoolDecision>
{
  readonly id = 'affix.pool.weight';

  apply({ facts, decision }: Parameters<Rule<AffixEligibilityFacts, AffixPoolDecision>['apply']>[0]): void {
    const accepted = [] as AffixPoolDecision['candidates'];
    const inputTagSet = new Set(
      facts.inputTagSignals.map((signal) => signal.tag),
    );

    for (const candidate of decision.candidates) {
      const tagHitCount = candidate.tags.reduce(
        (sum, tag) => sum + (inputTagSet.has(tag) ? 1 : 0),
        0,
      );
      const coverage =
        candidate.tags.length > 0 ? tagHitCount / candidate.tags.length : 0;

      if (candidate.weight <= 0) {
        decision.rejectedCandidates.push({
          affixId: candidate.id,
          reason: 'non_positive_weight',
          category: candidate.category,
        });
        decision.warnings.push({
          code: 'affix_non_positive_weight',
          message: '检测到非正权重词缀，已跳过',
          details: {
            affixId: candidate.id,
            weight: candidate.weight,
          },
        });
        continue;
      }

      const evaluationScore = candidate.evaluationScore ?? 1;

      // 优化 4：平滑评分放大系数与标签堆叠奖励，收窄权重极值，保留适当的随机惊喜
      const scoreMultiplier = 0.8 + 0.4 * evaluationScore;
      const tagBonus =
        1 +
        Math.max(0, tagHitCount - 1) *
          (CREATION_AFFIX_POOL_SCORING.tagHitBonus * 0.5) +
        coverage * (CREATION_AFFIX_POOL_SCORING.coverageBonus * 0.3);

      const weighted = Math.max(
        1,
        Math.round(candidate.weight * scoreMultiplier * tagBonus),
      );

      accepted.push({
        ...candidate,
        weight: weighted,
      });
    }

    decision.candidates = accepted;
    decision.trace.push({
      ruleId: this.id,
      outcome: 'applied',
      message: '完成候选权重合法性过滤',
      details: {
        accepted: accepted.length,
      },
    });
  }
}