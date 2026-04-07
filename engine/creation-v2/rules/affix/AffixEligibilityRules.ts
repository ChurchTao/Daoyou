import { QUALITY_ORDER } from '@/types/constants';
import { CREATION_AFFIX_POOL_SCORING } from '../../config/CreationBalance';
import { AffixCandidate } from '../../types';
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
    const scoreThresholds = CREATION_AFFIX_POOL_SCORING.minimumScoreByCategory;
    const minHits = CREATION_AFFIX_POOL_SCORING.minTagHitsByCategory;

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

      const tagHitCount = this.countTagHits(candidate, facts);
      const requiredHits = (minHits as Record<string, number>)[candidate.category] ?? 1;

      if (candidate.tags.length > 0 && tagHitCount < requiredHits) {
        decision.rejectedCandidates.push({
          affixId: candidate.id,
          reason: 'insufficient_tag_hits',
          category: candidate.category,
        });
        diagnostics.addTrace({
          ruleId: this.id,
          outcome: 'blocked',
          message: '词缀因标签命中不足被过滤',
          details: {
            affixId: candidate.id,
            tagHitCount,
            requiredHits,
          },
        });
        continue;
      }

      const evaluationScore = this.calculateEvaluationScore(
        candidate,
        facts,
        tagHitCount,
      );
      const threshold = (scoreThresholds as Record<string, number>)[candidate.category] ?? 0.45;

      if (evaluationScore < threshold) {
        decision.rejectedCandidates.push({
          affixId: candidate.id,
          reason: 'insufficient_admission_score',
          category: candidate.category,
          score: evaluationScore,
          threshold,
        });
        diagnostics.addTrace({
          ruleId: this.id,
          outcome: 'blocked',
          message: '词缀因 admission score 过低被过滤',
          details: {
            affixId: candidate.id,
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

  private countTagHits(
    candidate: AffixCandidate,
    facts: AffixEligibilityFacts,
  ): number {
    if (candidate.tags.length === 0) {
      return 1;
    }

    return candidate.tags.reduce(
      (sum, tag) => sum + (facts.tagSignalScores[tag] !== undefined ? 1 : 0),
      0,
    );
  }

  private calculateEvaluationScore(
    candidate: AffixCandidate,
    facts: AffixEligibilityFacts,
    tagHitCount: number,
  ): number {
    if (candidate.category === 'core' || candidate.tags.length === 0) {
      return 1;
    }

    const scoreWeights = CREATION_AFFIX_POOL_SCORING.scoreWeights;
    const matchedSignalSum = candidate.tags.reduce(
      (sum, tag) => sum + (facts.tagSignalScores[tag] ?? 0),
      0,
    );
    const coverage = tagHitCount / candidate.tags.length;
    const averageSignal = tagHitCount > 0 ? matchedSignalSum / tagHitCount : 0;
    const normalizedSignal = Math.min(
      1,
      averageSignal / CREATION_AFFIX_POOL_SCORING.maxSignalScorePerTag,
    );
    const qualityFit = this.calculateQualityFit(candidate, facts.maxQualityOrder);

    return Math.max(
      0,
      Math.min(
        1,
        coverage * scoreWeights.coverage +
          normalizedSignal * scoreWeights.signal +
          qualityFit * scoreWeights.qualityFit,
      ),
    );
  }

  private calculateQualityFit(
    candidate: AffixCandidate,
    qualityOrder: number,
  ): number {
    let fit = 1;

    if (candidate.minQuality !== undefined) {
      const minOrder = QUALITY_ORDER[candidate.minQuality];
      fit = Math.min(fit, this.clamp((qualityOrder - minOrder + 2) / 4, 0.45, 1));
    }

    if (candidate.maxQuality !== undefined) {
      const maxOrder = QUALITY_ORDER[candidate.maxQuality];
      fit = Math.min(fit, this.clamp((maxOrder - qualityOrder + 2) / 4, 0.45, 1));
    }

    return fit;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}