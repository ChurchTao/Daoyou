/*
 * SkillBlueprintComposer: 将 rolledAffixes 与 composition decision 投影为技能（active_skill）的 CreationBlueprint。
 * 使用 CompositionRuleSet 进行命名、能量换算与投影策略选择，产出可用于战斗层投影的 AbilityConfig。
 */
import { AffixEffectTranslator } from '../affixes/AffixEffectTranslator';
import { AffixRegistry } from '../affixes/AffixRegistry';
import { estimateBalanceMetrics } from '../balancing/PBU';
import { CreationSession } from '../CreationSession';
import { SkillProductModel } from '../models';
import { CreationBlueprint } from '../types';
import { CompositionRuleSet } from '../rules/composition/CompositionRuleSet';
import { CompositionFacts } from '../rules/contracts/CompositionFacts';
import { SkillProjectionPolicy } from '../rules/contracts/CompositionDecision';
import { buildCompositionFacts } from './shared';
import { buildAbilitySlug, ProductBlueprintComposer } from './types';

/**
 * 技能蓝图 Composer
 * 产出 active_skill（永远）
 * 已重构为使用 CompositionRuleSet，规则逻辑集中在 rules/composition/
 */
export class SkillBlueprintComposer implements ProductBlueprintComposer {
  private readonly compositionRuleSet: CompositionRuleSet;

  constructor(
    private readonly registry: AffixRegistry,
    translator: AffixEffectTranslator,
  ) {
    this.compositionRuleSet = new CompositionRuleSet(registry, translator);
  }

  compose(session: CreationSession): CreationBlueprint {
    const { rolledAffixes, input } = session.state;
    const facts: CompositionFacts = buildCompositionFacts(session, 'skill', this.registry);

    const decision = this.compositionRuleSet.evaluate(facts);
    const policy = decision.projectionPolicy as SkillProjectionPolicy | undefined;
    if (!policy || policy.kind !== 'active_skill') {
      throw new Error('CompositionRuleSet did not produce a skill projection policy');
    }

    const productModel: SkillProductModel = {
      productType: 'skill',
      slug: buildAbilitySlug(session.id, input.productType),
      name: decision.name,
      description: decision.description,
      outcomeTags: decision.outcomeTags,
      affixes: rolledAffixes,
      balanceMetrics: estimateBalanceMetrics(
        rolledAffixes,
        facts.materialQualityProfile.weightedAverageQuality,
      ),
      battleProjection: {
        projectionKind: 'active_skill',
        abilityTags: policy.abilityTags,
        mpCost: policy.mpCost,
        cooldown: policy.cooldown,
        priority: policy.priority,
        targetPolicy: policy.targetPolicy,
        effects: policy.effects,
        ...(policy.listeners && policy.listeners.length > 0
          ? { listeners: policy.listeners }
          : {}),
      },
    };

    return {
      productType: productModel.productType,
      productModel,
    };
  }
}
