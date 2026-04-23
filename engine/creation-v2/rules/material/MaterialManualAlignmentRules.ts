import { hasMissingMatchingManualForProduct } from '../../config/CreationCraftPolicy';
import { CreationProductType } from '../../types';
import { Rule } from '../core';
import { MaterialDecision, MaterialFacts } from '../contracts';

const WARNING_BY_PRODUCT: Partial<
  Record<CreationProductType, { code: string; message: string }>
> = {
  skill: {
    code: 'skill-missing-manual',
    message: '缺少神通秘籍参与，推演可用能量将被削减',
  },
  gongfa: {
    code: 'gongfa-missing-manual',
    message: '缺少功法秘籍参与，参悟可用能量将被削减',
  },
} as const;

export class MaterialManualAlignmentRules
  implements Rule<MaterialFacts, MaterialDecision>
{
  readonly id = 'material.manual.alignment';

  apply({
    facts,
    decision,
  }: Parameters<Rule<MaterialFacts, MaterialDecision>['apply']>[0]): void {
    const warning = WARNING_BY_PRODUCT[facts.productType];
    if (!warning) {
      decision.trace.push({
        ruleId: this.id,
        outcome: 'skipped',
        message: '当前产物类型不要求专用秘籍',
      });
      return;
    }

    const materialTypes = facts.fingerprints.map(
      (fingerprint) => fingerprint.materialType,
    );
    if (!hasMissingMatchingManualForProduct(facts.productType, materialTypes)) {
      decision.trace.push({
        ruleId: this.id,
        outcome: 'applied',
        message: '已命中当前产物所需的专用秘籍',
      });
      return;
    }

    decision.warnings.push({
      code: warning.code,
      message: warning.message,
      details: {
        productType: facts.productType,
      },
    });
    decision.trace.push({
      ruleId: this.id,
      outcome: 'applied',
      message: warning.message,
    });
  }
}