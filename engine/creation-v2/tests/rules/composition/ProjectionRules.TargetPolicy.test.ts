import { describe, expect, it } from '@jest/globals';
import { ProjectionRules } from '@/engine/creation-v2/rules/composition/ProjectionRules';
import { AffixEffectTranslator } from '@/engine/creation-v2/affixes/AffixEffectTranslator';
import { DEFAULT_AFFIX_REGISTRY, flattenAffixMatcherTags } from '@/engine/creation-v2/affixes';
import { CompositionFacts } from '@/engine/creation-v2/rules/contracts/CompositionFacts';
import { CompositionDecision, SkillProjectionPolicy } from '@/engine/creation-v2/rules/contracts/CompositionDecision';
import { RolledAffix } from '@/engine/creation-v2/types';
import { GameplayTags } from '@/engine/shared/tag-domain';

describe('ProjectionRules TargetPolicy 投影测试', () => {
  const translator = new AffixEffectTranslator();
  const rules = new ProjectionRules(DEFAULT_AFFIX_REGISTRY, translator);

  function toRolledAffix(id: string): RolledAffix {
    const def = DEFAULT_AFFIX_REGISTRY.queryById(id)!;
    return {
      id: def.id,
      name: def.displayName,
      category: def.category,
      energyCost: def.energyCost,
      rollScore: 1,
      rollEfficiency: 1,
      finalMultiplier: 1,
      isPerfect: false,
      effectTemplate: def.effectTemplate,
      weight: def.weight,
      match: def.match,
      tags: flattenAffixMatcherTags(def.match),
      grantedAbilityTags: def.grantedAbilityTags, // 关键：包含功能标签
      exclusiveGroup: def.exclusiveGroup,
    };
  }

  it('当意图中存在 targetPolicyBias 时，应优先使用玩家指定的策略', () => {
    const healCore = toRolledAffix('skill-core-heal');
    
    const facts: CompositionFacts = {
      productType: 'skill',
      intent: {
        productType: 'skill',
        dominantTags: [],
        targetPolicyBias: { team: 'ally', scope: 'aoe', maxTargets: 3 } // 玩家指定群体治疗队友
      },
      affixes: [healCore],
      materialQualityProfile: {
        maxQuality: '凡品',
        weightedAverageQuality: '凡品',
        minQuality: '凡品',
        maxQualityOrder: 0,
        weightedAverageOrder: 0,
        minQualityOrder: 0,
        qualitySpread: 0,
        totalQuantity: 1
      },
      defaultsApplied: []
    };

    const decision: CompositionDecision = {
      productType: 'skill',
      name: '测试技能',
      outcomeTags: [],
      affixes: [healCore],
      defaultsApplied: [],
      energyConversion: { mpCost: 10, priority: 1 }, // 模拟已转换能量
      trace: []
    };

    rules.apply({ facts, decision });

    const policy = decision.projectionPolicy as SkillProjectionPolicy;
    expect(policy.targetPolicy).toEqual({ team: 'ally', scope: 'aoe', maxTargets: 3 });
  });

  it('当意图中无策略时，应回退到核心词缀推断', () => {
    const damageCore = toRolledAffix('skill-core-damage');
    
    const facts: CompositionFacts = {
      productType: 'skill',
      intent: { productType: 'skill', dominantTags: [] },
      affixes: [damageCore],
      materialQualityProfile: {
        maxQuality: '凡品',
        weightedAverageQuality: '凡品',
        minQuality: '凡品',
        maxQualityOrder: 0,
        weightedAverageOrder: 0,
        minQualityOrder: 0,
        qualitySpread: 0,
        totalQuantity: 1
      },
      defaultsApplied: []
    };

    const decision: CompositionDecision = {
      productType: 'skill',
      name: '测试技能',
      outcomeTags: [],
      affixes: [damageCore],
      defaultsApplied: [],
      energyConversion: { mpCost: 10, priority: 1 },
      trace: []
    };

    rules.apply({ facts, decision });

    const policy = decision.projectionPolicy as SkillProjectionPolicy;
    expect(policy.targetPolicy.team).toBe('enemy');
    expect(policy.targetPolicy.scope).toBe('single');
  });
});
