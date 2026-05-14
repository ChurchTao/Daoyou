import { CREATION_AFFIX_POOL_SCORING } from '../../config/CreationBalance';
import { AffixCandidate } from '../../types';
import { evaluateAffixMatcher } from '../../affixes/AffixMatcher';
import { Rule } from '../core';
import { AffixEligibilityFacts, AffixPoolDecision } from '../contracts';

/*
 * AffixEligibilityRules: 对候选词缀进行匹配与 admission score 判断，并记录 rejectedCandidates。
 */
export class AffixEligibilityRules
  implements Rule<AffixEligibilityFacts, AffixPoolDecision>
{
  readonly id = 'affix.pool.eligibility';

  apply({ facts, decision }: Parameters<Rule<AffixEligibilityFacts, AffixPoolDecision>['apply']>[0]): void {
    const accepted = [] as AffixPoolDecision['candidates'];
    const scoreThresholds = CREATION_AFFIX_POOL_SCORING.minimumScoreByCategory;

    for (const candidate of facts.candidatePool) {
      const matchResult = evaluateAffixMatcher(candidate.match, facts.inputTagSignals);

      if (!matchResult.matched) {
        decision.rejectedCandidates.push({
          affixId: candidate.id,
          reason: 'match_unmet',
          category: candidate.category,
        });
        decision.trace.push({
          ruleId: this.id,
          outcome: 'blocked',
          message: '词缀因 match 条件未满足被过滤',
          details: {
            affixId: candidate.id,
            match: candidate.match,
            blockedTags: matchResult.blockedTags,
          },
        });
        continue;
      }

      const baseEvaluationScore = this.calculateEvaluationScore(
        candidate,
        facts,
        matchResult,
      );
      const negativePenalty = this.calculateNegativePenalty(candidate.tags, facts);
      const evaluationScore = Math.max(0, baseEvaluationScore - negativePenalty);
      const threshold = (scoreThresholds as Record<string, number>)[candidate.category] ?? 0.45;

      if (evaluationScore < threshold) {
        decision.rejectedCandidates.push({
          affixId: candidate.id,
          reason: 'insufficient_admission_score',
          category: candidate.category,
          score: evaluationScore,
          threshold,
        });
        decision.trace.push({
          ruleId: this.id,
          outcome: 'blocked',
          message: '词缀因 admission score 过低被过滤',
          details: {
            affixId: candidate.id,
            baseEvaluationScore,
            negativePenalty,
            evaluationScore,
            threshold,
          },
        });
        continue;
      }

      accepted.push({
        ...candidate,
        evaluationScore,
      });
    }

    decision.candidates = accepted;

    decision.trace.push({
      ruleId: this.id,
      outcome: 'applied',
      message: '完成候选资格过滤',
      details: {
        accepted: accepted.length,
        rejected: decision.rejectedCandidates.length,
      },
    });
  }

  private calculateEvaluationScore(
    candidate: AffixCandidate,
    facts: AffixEligibilityFacts,
    matchResult: ReturnType<typeof evaluateAffixMatcher>,
  ): number {
    if (
      ['skill_core', 'gongfa_foundation', 'artifact_core'].includes(
        candidate.category,
      ) ||
      matchResult.totalUnits === 0
    ) {
      return 1;
    }

    const scoreWeights = CREATION_AFFIX_POOL_SCORING.scoreWeights;

    // 优化 2：取命中标签中的最高信号分，避免强信号被弱信号平均稀释
    const maxSignal = matchResult.matchedTags.reduce(
      (max, tag) => Math.max(max, facts.tagSignalScores[tag] ?? 0),
      0,
    );
    const coverage = matchResult.satisfiedUnits / matchResult.totalUnits;
    const normalizedSignal = Math.min(
      1,
      maxSignal / CREATION_AFFIX_POOL_SCORING.maxSignalScorePerTag,
    );

    return Math.max(
      0,
      Math.min(
        1,
        coverage * scoreWeights.coverage +
          normalizedSignal * scoreWeights.signal,
      ),
    );
  }

  private calculateNegativePenalty(
    candidateTags: string[],
    facts: AffixEligibilityFacts,
  ): number {
    if (!facts.negativeTagBiases?.length) {
      return 0;
    }

    const matchedWeight = facts.negativeTagBiases.reduce(
      (sum, bias) => (candidateTags.includes(bias.tag) ? sum + bias.weight : sum),
      0,
    );

    return Math.min(0.35, matchedWeight * 0.16);
  }
}
