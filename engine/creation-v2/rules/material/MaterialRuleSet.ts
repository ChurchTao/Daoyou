import { CREATION_PHASES } from '../../types';
import { MaterialDecision, MaterialFacts } from '../contracts';
import { RuleSet } from '../core';
import { MaterialConflictRules } from './MaterialConflictRules';

export class MaterialRuleSet {
  private readonly ruleSet = new RuleSet<MaterialFacts, MaterialDecision>(
    [
      new MaterialConflictRules(),
    ],
    (facts) => ({
      valid: true,
      normalizedTags: [...facts.normalizedTags],
      dominantTags: [...facts.dominantTags],
      recipeTags: [...facts.recipeTags],
      notes: [],
      reasons: [],
      warnings: [],
      trace: [],
    }),
  );

  evaluate(facts: MaterialFacts): MaterialDecision {
    return this.ruleSet.evaluate(facts, {
      metadata: {
        phase: CREATION_PHASES.MATERIAL_VALIDATION,
      },
    });
  }
}