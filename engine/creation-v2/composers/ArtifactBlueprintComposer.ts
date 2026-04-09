/*
 * ArtifactBlueprintComposer: 将 rolledAffixes 与 composition decision 投影为法宝（artifact）的 CreationBlueprint。
 * 负责域模型组装并调用 projectAbilityConfig 生成战斗层 AbilityConfig 表示。
 */
import { AffixEffectTranslator } from '../affixes/AffixEffectTranslator';
import { AffixRegistry } from '../affixes/AffixRegistry';
import { estimateBalanceMetrics } from '../balancing/PBU';
import { CreationSession } from '../CreationSession';
import { ArtifactProductModel } from '../models';
import { ARTIFACT_POLICIES, ArtifactDomainConfig } from '../models/types';
import { CreationBlueprint } from '../types';
import { CompositionRuleSet } from '../rules/composition/CompositionRuleSet';
import { CompositionFacts } from '../rules/contracts/CompositionFacts';
import { PassiveProjectionPolicy } from '../rules/contracts/CompositionDecision';
import { buildCompositionFacts } from './shared';
import { buildAbilitySlug, ProductBlueprintComposer } from './types';

/**
 * 法宝蓝图 Composer
 * 领域层产出 artifact，战斗层投影为 passive ability
 * 已重构为使用 CompositionRuleSet，规则逻辑集中在 rules/composition/
 */
export class ArtifactBlueprintComposer implements ProductBlueprintComposer {
  private readonly compositionRuleSet: CompositionRuleSet;

  constructor(
    private readonly registry: AffixRegistry,
    translator: AffixEffectTranslator,
  ) {
    this.compositionRuleSet = new CompositionRuleSet(registry, translator);
  }

  compose(session: CreationSession): CreationBlueprint {
    const { rolledAffixes, input } = session.state;
    const facts: CompositionFacts = buildCompositionFacts(session, 'artifact', 'artifact', this.registry);

    const decision = this.compositionRuleSet.evaluate(facts);
    const policy = decision.projectionPolicy as PassiveProjectionPolicy | undefined;
    if (!policy || policy.kind !== 'artifact_passive') {
      throw new Error('CompositionRuleSet did not produce an artifact projection policy');
    }

    const slotBias = facts.intent.slotBias;
    const domainConfig: ArtifactDomainConfig = {
      slot: slotBias,
      equipPolicy: ARTIFACT_POLICIES.EQUIP,
      persistencePolicy: ARTIFACT_POLICIES.PERSISTENCE,
      progressionPolicy: ARTIFACT_POLICIES.PROGRESSION,
    };

    const productModel: ArtifactProductModel = {
      productType: 'artifact',
      outcomeKind: 'artifact',
      slug: buildAbilitySlug(session.id, input.productType),
      name: decision.name,
      description: decision.description,
      tags: decision.tags,
      affixes: rolledAffixes,
      balanceMetrics: estimateBalanceMetrics(
        rolledAffixes,
        facts.materialQualityProfile.weightedAverageQuality,
      ),
      artifactConfig: domainConfig,
      battleProjection: {
        projectionKind: 'artifact_passive',
        abilityTags: policy.abilityTags,
        listeners: policy.listeners,
        modifiers: policy.modifiers,
      },
    };

    return {
      outcomeKind: productModel.outcomeKind,
      productModel,
    };
  }
}
