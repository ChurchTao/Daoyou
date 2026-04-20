import { CREATION_PHASES } from '../../types';
import { AffixEligibilityFacts, AffixPoolDecision } from '../contracts';
import { RuleSet } from '../core';
import { AffixEligibilityRules } from './AffixEligibilityRules';
import { AffixWeightRules } from './AffixWeightRules';

/*
 * AffixPoolRuleSet: 词缀候选池的规则集合门面。
 * 将 AffixEligibilityFacts 交给内部规则（AffixEligibilityRules, AffixWeightRules）执行，
 * 并初始化 Decision 的默认结构。用于 AffixPoolBuilder 中做候选过滤与加权。
 */
export class AffixPoolRuleSet {
  private readonly ruleSet = new RuleSet<AffixEligibilityFacts, AffixPoolDecision>(
    [new AffixEligibilityRules(), new AffixWeightRules()],
    (facts) => ({
      candidates: [...facts.candidatePool],
      rejectedCandidates: [],
      exhaustionReason: undefined,
      reasons: [],
      warnings: [],
      trace: [],
    }),
  );

  evaluate(facts: AffixEligibilityFacts): AffixPoolDecision {
    return this.ruleSet.evaluate(facts, {
      metadata: {
        phase: CREATION_PHASES.AFFIX_POOL_BUILD,
      },
    });
  }
}