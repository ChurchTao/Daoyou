import { CREATION_AFFIX_POOL_SCORING } from '../../config/CreationBalance';
import { AFFIX_STOP_REASONS, AffixCategory } from '../../types';
import { Rule } from '../core';
import { AffixSelectionDecision, AffixSelectionFacts } from '../contracts';

/*
 * HighTierBucketRules: 约束 signature/synergy/mythic 的总量，
 * 避免修复类别 cap 后重新回到高阶词缀泛滥。
 */
export class HighTierBucketRules
  implements Rule<AffixSelectionFacts, AffixSelectionDecision>
{
  readonly id = 'affix.selection.high-tier-bucket';

  apply({ facts, decision, diagnostics }: Parameters<Rule<AffixSelectionFacts, AffixSelectionDecision>['apply']>[0]): void {
    const bucketCaps = facts.selectionConstraints.bucketCaps;

    if (!bucketCaps) {
      diagnostics.addTrace({
        ruleId: this.id,
        outcome: 'applied',
        message: '未提供高阶桶约束，跳过过滤',
      });
      return;
    }

    const highTierCategories = new Set<AffixCategory>(
      CREATION_AFFIX_POOL_SCORING.highTierCategories as readonly AffixCategory[],
    );
    const selectedHighTierCount = Object.entries(facts.selectedCategoryCounts).reduce(
      (sum, [category, count]) =>
        highTierCategories.has(category as AffixCategory) ? sum + (count ?? 0) : sum,
      0,
    );
    const selectedMythicCount = facts.selectedCategoryCounts.mythic ?? 0;
    const accepted = [] as AffixSelectionDecision['candidatePool'];

    for (const candidate of decision.candidatePool) {
      if (
        candidate.category === 'mythic' &&
        bucketCaps.mythic !== undefined &&
        selectedMythicCount >= bucketCaps.mythic
      ) {
        decision.rejections.push({
          affixId: candidate.id,
          amount: candidate.energyCost,
          reason: AFFIX_STOP_REASONS.CATEGORY_QUOTA_REACHED,
          ...(candidate.exclusiveGroup
            ? { exclusiveGroup: candidate.exclusiveGroup }
            : {}),
        });
        diagnostics.addTrace({
          ruleId: this.id,
          outcome: 'blocked',
          message: '词缀因 mythic 桶上限被过滤',
          details: {
            affixId: candidate.id,
            category: candidate.category,
            current: selectedMythicCount,
            cap: bucketCaps.mythic,
          },
        });
        continue;
      }

      if (
        highTierCategories.has(candidate.category) &&
        bucketCaps.highTierTotal !== undefined &&
        selectedHighTierCount >= bucketCaps.highTierTotal
      ) {
        decision.rejections.push({
          affixId: candidate.id,
          amount: candidate.energyCost,
          reason: AFFIX_STOP_REASONS.CATEGORY_QUOTA_REACHED,
          ...(candidate.exclusiveGroup
            ? { exclusiveGroup: candidate.exclusiveGroup }
            : {}),
        });
        diagnostics.addTrace({
          ruleId: this.id,
          outcome: 'blocked',
          message: '词缀因高阶桶上限被过滤',
          details: {
            affixId: candidate.id,
            category: candidate.category,
            current: selectedHighTierCount,
            cap: bucketCaps.highTierTotal,
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
      message: `高阶桶过滤完成：${accepted.length} 个词缀通过`,
      details: {
        selectedHighTierCount,
        selectedMythicCount,
        bucketCaps,
      },
    });
  }
}