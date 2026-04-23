import { describe, expect, it, beforeEach } from '@jest/globals';
import { CompositionRuleSet } from '@/engine/creation-v2/rules/composition/CompositionRuleSet';
import { DEFAULT_AFFIX_REGISTRY, flattenAffixMatcherTags } from '@/engine/creation-v2/affixes';
import type { CompositionFacts } from '@/engine/creation-v2/rules/contracts/CompositionFacts';
import type { AffixDefinition } from '@/engine/creation-v2/affixes/types';
import type { RolledAffix } from '@/engine/creation-v2/types';
import { CREATION_SKILL_DEFAULTS } from '@/engine/creation-v2/config/CreationBalance';

function toRolledAffix(def: AffixDefinition): RolledAffix {
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
    grantedAbilityTags: def.grantedAbilityTags,
    exclusiveGroup: def.exclusiveGroup,
  };
}

function buildFacts(qualityOrder: number): CompositionFacts {
  const skillCore = DEFAULT_AFFIX_REGISTRY.queryById('skill-core-damage');
  const quality = (['凡品', '灵品', '玄品', '真品', '地品', '天品', '仙品', '神品'] as const)[qualityOrder];

  return {
    productType: 'skill',
    intent: {
      productType: 'skill',
      dominantTags: [],
      elementBias: '火',
    },
    recipeMatch: {
      recipeId: 'skill-default',
      valid: true,
      matchedTags: [],
      unlockedAffixCategories: [],
    },
    energySummary: {
      effectiveTotal: 30, // Some constant energy
      reserved: 3,
      startingAffixEnergy: 27,
      spentAffixEnergy: 8,
      remainingAffixEnergy: 19,
    },
    materialNames: ['测试材料'],
    affixes: skillCore ? [toRolledAffix(skillCore)] : [],
    materialQualityProfile: {
      maxQuality: quality,
      weightedAverageQuality: quality,
      minQuality: quality,
      maxQualityOrder: qualityOrder,
      weightedAverageOrder: qualityOrder,
      minQualityOrder: qualityOrder,
      qualitySpread: 0,
      totalQuantity: 1,
    },
    inputTags: [],
    materialFingerprints: [],
  };
}

describe('ScalingRules (mpCost and cooldown)', () => {
  let ruleSet: CompositionRuleSet;

  beforeEach(() => {
    ruleSet = new CompositionRuleSet(DEFAULT_AFFIX_REGISTRY);
  });

  it('mpCost 应随品质指数级增长', () => {
    // 凡品 (Order 0): 80 * 2^0 = 80
    const decision0 = ruleSet.evaluate(buildFacts(0));
    expect((decision0.projectionPolicy as any).mpCost).toBe(80);

    // 灵品 (Order 1): 80 * 2^1 = 160
    const decision1 = ruleSet.evaluate(buildFacts(1));
    expect((decision1.projectionPolicy as any).mpCost).toBe(160);

    // 神品 (Order 7): 80 * 2^7 = 10240
    const decision7 = ruleSet.evaluate(buildFacts(7));
    expect((decision7.projectionPolicy as any).mpCost).toBe(10240);
  });

  it('cooldown 应随品质在 2~8 之间波动', () => {
    // 凡品 (Order 0): 伤害基础 2 + 补偿 0 = 2
    const decision0 = ruleSet.evaluate(buildFacts(0));
    expect((decision0.projectionPolicy as any).cooldown).toBe(2);

    // 真品 (Order 3): 伤害基础 2 + 补偿 2 = 4
    const decision3 = ruleSet.evaluate(buildFacts(3));
    expect((decision3.projectionPolicy as any).cooldown).toBe(4);

    // 神品 (Order 7): 伤害基础 2 + 补偿 6 = 8
    const decision7 = ruleSet.evaluate(buildFacts(7));
    expect((decision7.projectionPolicy as any).cooldown).toBe(8);
    
    // 检查封顶逻辑 (假设基础 CD 很大)
    // 实际上我们可以通过修改 Facts 来模拟其他 coreType
  });

  it('治疗技能的冷却封顶逻辑', () => {
    const healCore = DEFAULT_AFFIX_REGISTRY.queryById('skill-core-heal');
    const facts = buildFacts(7);
    if (healCore) facts.affixes = [toRolledAffix(healCore)];
    
    // 神品 (Order 7) 治疗: 基础 3 + 补偿 6 = 9 -> 封顶 8
    const decision = ruleSet.evaluate(facts);
    expect((decision.projectionPolicy as any).cooldown).toBe(8);
  });
});
