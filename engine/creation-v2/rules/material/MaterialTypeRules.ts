import { CreationTags } from '@/engine/shared/tag-domain';
import { Rule } from '../core';
import { RuleContext } from '../core/RuleContext';
import { MaterialDecision } from '../contracts/MaterialDecision';
import { MaterialFacts } from '../contracts/MaterialFacts';

/**
 * MaterialTypeRules
 *
 * 溯源并记录每一个材料指纹中的显式标签（类型标签、品质标签、元素标签），
 * 为 MaterialDecision 的 normalizedTags 提供可审计的 RuleTrace。
 *
 * 此规则不修改 normalizedTags（已由 MaterialFactsBuilder 正确聚合），
 * 仅在 trace 层按材料记录显式标签的来源，使造物决策过程可解释。
 */
/*
 * MaterialTypeRules: 溯源并记录材料的显式类型/品质/元素标签到 RuleTrace，帮助审计材料来源。
 */
export class MaterialTypeRules implements Rule<MaterialFacts, MaterialDecision> {
  readonly id = 'material.type-tags';

  apply({ facts, decision }: RuleContext<MaterialFacts, MaterialDecision>): void {
    if (facts.fingerprints.length === 0) {
      decision.trace.push({
        ruleId: this.id,
        outcome: 'skipped',
        message: '无材料指纹，跳过类型标签溯源',
      });
      return;
    }

    for (const fp of facts.fingerprints) {
      const typeTags = fp.explicitTags.filter(
        (t) =>
          t.startsWith(CreationTags.MATERIAL.TYPE) ||
          t.startsWith(CreationTags.MATERIAL.QUALITY) ||
          t.startsWith(CreationTags.MATERIAL.ELEMENT),
      );

      decision.trace.push({
        ruleId: this.id,
        outcome: 'applied',
        message: `材料「${fp.materialName}」(${fp.materialType}) 贡献 ${typeTags.length} 个显式类型标签`,
        details: {
          materialName: fp.materialName,
          materialType: fp.materialType,
          typeTags,
        },
      });
    }
  }
}
