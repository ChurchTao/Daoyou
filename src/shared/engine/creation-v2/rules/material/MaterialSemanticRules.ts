import { Rule } from '../core';
import { RuleContext } from '../core/RuleContext';
import { MaterialDecision } from '../contracts/MaterialDecision';
import { MaterialFacts } from '../contracts/MaterialFacts';

/**
 * MaterialSemanticRules
 *
 * 溯源并记录每一个材料指纹中的语义标签（由 MaterialTagNormalizer 关键词匹配产出），
 * 为 MaterialDecision 提供可审计的 RuleTrace。
 *
 * 此规则不修改 normalizedTags（已由 MaterialFactsBuilder 正确聚合），
 * 仅在 trace 层按材料记录语义标签来源，使模糊匹配结果可追溯。
 * 对无语义标签的材料单独记录 skipped trace，便于调试分析覆盖空白。
 */
/*
 * MaterialSemanticRules: 溯源并记录材料的语义标签（由 MaterialTagNormalizer 产出）到 RuleTrace，便于调试与覆盖率分析。
 */
export class MaterialSemanticRules implements Rule<MaterialFacts, MaterialDecision> {
  readonly id = 'material.semantic-tags';

  apply({ facts, decision }: RuleContext<MaterialFacts, MaterialDecision>): void {
    if (facts.fingerprints.length === 0) {
      decision.trace.push({
        ruleId: this.id,
        outcome: 'skipped',
        message: '无材料指纹，跳过语义标签溯源',
      });
      return;
    }

    for (const fp of facts.fingerprints) {
      if (fp.semanticTags.length === 0) {
        decision.trace.push({
          ruleId: this.id,
          outcome: 'skipped',
          message: `材料「${fp.materialName}」无语义标签（名称/描述未命中任何语义模式）`,
          details: { materialName: fp.materialName, materialType: fp.materialType },
        });
        continue;
      }

      decision.trace.push({
        ruleId: this.id,
        outcome: 'applied',
        message: `材料「${fp.materialName}」贡献 ${fp.semanticTags.length} 个语义标签`,
        details: {
          materialName: fp.materialName,
          semanticTags: fp.semanticTags,
        },
      });
    }
  }
}
