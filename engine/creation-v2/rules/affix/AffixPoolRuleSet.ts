import { CREATION_PHASES } from '../../types';
import { AffixEligibilityFacts, AffixPoolDecision } from '../contracts';
import { RuleSet } from '../core';
import { AffixEligibilityRules } from './AffixEligibilityRules';
import { AffixWeightRules } from './AffixWeightRules';

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