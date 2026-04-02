import { ELEMENT_NAME_PREFIX } from '../../config/CreationMappings';
import {
  ARTIFACT_SLOT_DISPLAY_NAMES,
  CREATION_ARTIFACT_NAMING,
  CREATION_DESCRIPTION_TEMPLATE,
  CREATION_GONGFA_NAMING,
  CREATION_SKILL_NAMING,
} from '../../config/CreationNamingPolicy';
import { Rule } from '../core/Rule';
import { RuleDiagnostics } from '../core/RuleDiagnostics';
import { RuleContext } from '../core/RuleContext';
import { CompositionDecision } from '../contracts/CompositionDecision';
import { CompositionFacts } from '../contracts/CompositionFacts';

/**
 * NamingRules
 * 根据产物类型、元素偏向、材料名称决定命名策略
 */
/*
 * NamingRules: 负责为产物生成/验证名称，处理命名冲突与名称格式化。
 */
export class NamingRules implements Rule<CompositionFacts, CompositionDecision> {
  readonly id = 'composition.naming';

  apply({
    facts,
    decision,
    diagnostics,
  }: RuleContext<CompositionFacts, CompositionDecision>): void {
    decision.name = this.resolveName(facts, diagnostics);
    decision.description = this.resolveDescription(facts);

    diagnostics.addTrace({
      ruleId: this.id,
      outcome: 'applied',
      message: `命名决策：${decision.name}`,
    });
  }

  private resolveName(facts: CompositionFacts, diagnostics: RuleDiagnostics): string {
    const { productType, intent, materialNames } = facts;
    const elementBias = intent.elementBias;

    switch (productType) {
      case 'skill': {
        const prefix = elementBias
          ? ELEMENT_NAME_PREFIX[elementBias]
          : CREATION_SKILL_NAMING.defaultPrefix;
        return `${prefix}${CREATION_SKILL_NAMING.nameSuffix}`;
      }
      case 'artifact': {
        const slotDisplayName = intent.slotBias
          ? (ARTIFACT_SLOT_DISPLAY_NAMES[intent.slotBias] ?? intent.slotBias)
          : undefined;
        return slotDisplayName
          ? `${slotDisplayName}${CREATION_ARTIFACT_NAMING.slotSuffix}`
          : CREATION_ARTIFACT_NAMING.defaultName;
      }
      case 'gongfa': {
        if (!materialNames[0]) {
          diagnostics.addTrace({
            ruleId: this.id,
            outcome: 'applied',
            message: `功法命名：materialNames[0] 为空，fallback 到默认名称 ${CREATION_GONGFA_NAMING.defaultName}`,
          });
          return CREATION_GONGFA_NAMING.defaultName;
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
