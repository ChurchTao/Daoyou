import { CREATION_PHASES } from '../../types';
import { AffixSelectionDecision, AffixSelectionFacts } from '../contracts';
import { RuleSet } from '../core';
import { BudgetExhaustionRules } from './BudgetExhaustionRules';
import { ExclusiveGroupRules } from './ExclusiveGroupRules';
import { FallbackAffixRules } from './FallbackAffixRules';

/*
 * AffixSelectionRuleSet: 词缀选择阶段的规则集合门面。
 * 包含 ExclusiveGroupRules / BudgetExhaustionRules / FallbackAffixRules，负责根据 facts 输出可供抽签的 candidatePool 及审计信息。
 */
export class AffixSelectionRuleSet {
  private readonly ruleSet = new RuleSet<AffixSelectionFacts, AffixSelectionDecision>(
    [new ExclusiveGroupRules(), new BudgetExhaustionRules(), new FallbackAffixRules()],
    (facts) => ({
      candidatePool: [...facts.candidates],
      affixes: [],
      spent: 0,
      remaining: facts.remainingEnergy,
      allocations: [],
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
        phase: CREATION_PHASES.AFFIX_SELECTION,
      },
    });
  }
}