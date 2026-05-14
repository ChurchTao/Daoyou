import { CREATION_RULE_PHASES } from '../../types';
import { MaterialDecision, MaterialFacts } from '../contracts';
import { RuleSet } from '../core';
import { MaterialConflictRules } from './MaterialConflictRules';
import { MaterialManualAlignmentRules } from './MaterialManualAlignmentRules';
import { MaterialSemanticRules } from './MaterialSemanticRules';
import { MaterialTypeRules } from './MaterialTypeRules';
import { RecipeBiasRules } from './RecipeBiasRules';

/*
 * MaterialRuleSet: 材料校验规则集合门面。
 * 责任：执行材料相关的一系列规则（类型/语义/配方偏向/冲突检测），并返回 MaterialDecision。
 */
export class MaterialRuleSet {
  private readonly ruleSet = new RuleSet<MaterialFacts, MaterialDecision>(
    [
      // Stage 2: 类型/语义/配方偏向标签溯源（产出 trace，使决策可解释）
      new MaterialTypeRules(),
      new MaterialSemanticRules(),
      new RecipeBiasRules(),
      // 冲突检测（可修改 valid 字段）
      new MaterialConflictRules(),
      // 非阻断提示：缺少对应秘籍时会削减预算
      new MaterialManualAlignmentRules(),
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
        phase: CREATION_RULE_PHASES.MATERIAL_VALIDATION,
      },
    });
  }
}