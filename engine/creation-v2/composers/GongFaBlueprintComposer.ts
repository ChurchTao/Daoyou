import { AffixEffectTranslator } from '../affixes/AffixEffectTranslator';
import { AffixRegistry } from '../affixes/AffixRegistry';
import { CreationSession } from '../CreationSession';
import { GongFaProductModel, projectAbilityConfig } from '../models';
import { GONGFA_POLICIES, GongFaDomainConfig } from '../models/types';
import { CreationBlueprint } from '../types';
import { CompositionRuleSet } from '../rules/composition/CompositionRuleSet';
import { CompositionFacts } from '../rules/contracts/CompositionFacts';
import { PassiveProjectionPolicy } from '../rules/contracts/CompositionDecision';
import { buildCompositionFacts } from './shared';
import { buildAbilitySlug, ProductBlueprintComposer } from './types';

/**
 * 功法蓝图 Composer
 * 领域层产出 gongfa，战斗层投影为 passive ability
 * 已重构为使用 CompositionRuleSet，规则逻辑集中在 rules/composition/
 */
export class GongFaBlueprintComposer implements ProductBlueprintComposer {
  private readonly compositionRuleSet: CompositionRuleSet;

  constructor(
    private readonly registry: AffixRegistry,
    translator: AffixEffectTranslator,
  ) {
    this.compositionRuleSet = new CompositionRuleSet(registry, translator);
  }

  compose(session: CreationSession): CreationBlueprint {
    const { rolledAffixes, input } = session.state;
    const facts: CompositionFacts = buildCompositionFacts(session, 'gongfa', 'gongfa', this.registry);

    const decision = this.compositionRuleSet.evaluate(facts);
    const policy = decision.projectionPolicy as PassiveProjectionPolicy | undefined;
    if (!policy || policy.kind !== 'gongfa_passive') {
      throw new Error('CompositionRuleSet did not produce a gongfa projection policy');
    }

    const domainConfig: GongFaDomainConfig = {
      equipPolicy: GONGFA_POLICIES.EQUIP,
      persistencePolicy: GONGFA_POLICIES.PERSISTENCE,
      progressionPolicy: GONGFA_POLICIES.PROGRESSION,
    };

    const productModel: GongFaProductModel = {
      productType: 'gongfa',
      outcomeKind: 'gongfa',
      slug: buildAbilitySlug(session.id, input.productType),
      name: decision.name,
      description: decision.description,
      tags: decision.tags,
      affixes: rolledAffixes,
      abilityTags: policy.abilityTags,
      gongfaConfig: domainConfig,
      battleProjection: {
        projectionKind: 'gongfa_passive',
        abilityTags: policy.abilityTags,
        listeners: policy.listeners,
      },
    };

    return {
      outcomeKind: productModel.outcomeKind,
      productModel,
      abilityConfig: projectAbilityConfig(productModel),
    };
  }
}
