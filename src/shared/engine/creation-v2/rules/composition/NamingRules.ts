import { ELEMENT_NAME_PREFIX } from '../../config/CreationMappings';
import {
  ARTIFACT_SLOT_DISPLAY_NAMES,
  CREATION_ARTIFACT_NAMING,
  CREATION_DESCRIPTION_TEMPLATE,
  CREATION_GONGFA_NAMING,
  CREATION_SKILL_NAMING,
} from '../../config/CreationNamingPolicy';
import { Rule } from '../core/Rule';
import { RuleContext } from '../core/RuleContext';
import { CompositionDecision } from '../contracts/CompositionDecision';
import { CompositionFacts } from '../contracts/CompositionFacts';
import { CreationError } from '../../errors';

/**
 * NamingRules
 * 根据产物类型、元素偏向、材料名称决定命名策略
 */
/*
 * NamingRules: 负责为产物生成/验证名称，处理命名冲突与名称格式化。
 */
export class NamingRules implements Rule<CompositionFacts, CompositionDecision> {
  readonly id = 'composition.naming';

  apply({ facts, decision }: RuleContext<CompositionFacts, CompositionDecision>): void {
    decision.name = this.resolveName(facts);
    decision.description = this.resolveDescription(facts);

    decision.trace.push({
      ruleId: this.id,
      outcome: 'applied',
      message: `命名决策：${decision.name}`,
    });
  }

  private resolveName(facts: CompositionFacts): string {
    const { productType, intent, materialNames } = facts;
    const elementBias = intent.elementBias;

    switch (productType) {
      case 'skill': {
        if (!elementBias) {
          throw new CreationError(
            'Composition',
            'MISSING_ELEMENT_BIAS',
            '技能命名失败：缺少元素偏向',
            { facts }
          );
        }
        const prefix = ELEMENT_NAME_PREFIX[elementBias];
        return `${prefix}${CREATION_SKILL_NAMING.nameSuffix}`;
      }
      case 'artifact': {
        const slotDisplayName = intent.slotBias
          ? (ARTIFACT_SLOT_DISPLAY_NAMES[intent.slotBias] ?? intent.slotBias)
          : undefined;
        if (!slotDisplayName) {
          throw new CreationError(
            'Composition',
            'MISSING_SLOT_BIAS',
            '法宝命名失败：缺少部位偏向',
            { facts }
          );
        }
        return `${slotDisplayName}${CREATION_ARTIFACT_NAMING.slotSuffix}`;
      }
      case 'gongfa': {
        if (!materialNames[0]) {
          throw new CreationError(
            'Composition',
            'NAMING_FAILED',
            '功法命名失败：缺少主要材料名称',
            { facts }
          );
        }
        return `${materialNames[0]}${CREATION_GONGFA_NAMING.nameSuffix}`;
      }
      default: {
        const _exhaustive: never = productType;
        return `未知产物_${_exhaustive}`;
      }
    }
  }

  private resolveDescription(facts: CompositionFacts): string {
    return `${CREATION_DESCRIPTION_TEMPLATE.materialListPrefix}${facts.materialNames.join('、')}${CREATION_DESCRIPTION_TEMPLATE.materialListSuffix}`;
  }
}
