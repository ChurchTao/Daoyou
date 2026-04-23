import { CREATION_RULE_PHASES } from '../../types';
import { AffixSelectionDecision, AffixSelectionFacts } from '../contracts';
import { RuleSet } from '../core';
import { BudgetExhaustionRules } from './BudgetExhaustionRules';
import { CategoryQuotaRules } from './CategoryQuotaRules';
import { ExclusiveGroupRules } from './ExclusiveGroupRules';
import { FallbackAffixRules } from './FallbackAffixRules';
import { HighTierBucketRules } from './HighTierBucketRules';

/*
 * AffixSelectionRuleSet: 词缀选择阶段的规则集合门面。
 * 包含 ExclusiveGroupRules / BudgetExhaustionRules / FallbackAffixRules，负责根据 facts 输出可供抽签的 candidatePool 及审计信息。
 */
export class AffixSelectionRuleSet {
  private readonly ruleSet = new RuleSet<AffixSelectionFacts, AffixSelectionDecision>(
    [
      new ExclusiveGroupRules(),
      new CategoryQuotaRules(),
      new HighTierBucketRules(),
      new BudgetExhaustionRules(),
      new FallbackAffixRules(),
    ],
    (facts) => ({
      candidatePool: [...facts.candidates],
      rejections: [],
      exhaustionReason: undefined,
      reasons: [],
      warnings: [],
      trace: [],
    }),
  );

  evaluate(facts: AffixSelectionFacts): AffixSelectionDecision {
    return this.ruleSet.evaluate(facts, {
      metadata: {
        phase: CREATION_RULE_PHASES.AFFIX_SELECTION,
      },
    });
  }
}