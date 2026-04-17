import { GameplayTags } from '@/engine/shared/tag-domain';
import { resolveAffixSlotCount } from '@/engine/creation-v2/config/CreationBalance';
import { CreationTags } from '@/engine/shared/tag-domain';
import { TestableCreationOrchestrator } from '@/engine/creation-v2/tests/helpers/TestableCreationOrchestrator';
import { CreationProductType } from '@/engine/creation-v2/types';
import { Material } from '@/types/cultivator';

const SEEDS = Array.from({ length: 80 }, (_, index) => 4200 + index);

const HIGH_TIER_MATERIAL_SETS: Record<CreationProductType, Material[]> = {
  skill: [
    {
      id: 'skill-special-core',
      name: '神裂锋晶',
      type: 'tcdb',
      rank: '神品',
      quantity: 3,
      description: '神锋爆裂之灵晶，古卷回响，裂空斩魄',
    },
    {
      id: 'skill-manual',
      name: '永恒灵诀残卷',
      type: 'skill_manual',
      rank: '仙品',
      quantity: 3,
      description: '灵诀古卷，神念与剑锋共鸣',
    },
    {
      id: 'skill-monster',
      name: '狂雷兽核',
      type: 'monster',
      rank: '天品',
      quantity: 3,
      description: '狂烈雷霆与爆发刃意交织',
    },
    {
      id: 'skill-ore',
      name: '裂空玄铁',
      type: 'ore',
      rank: '仙品',
      quantity: 3,
      description: '锋刃裂空，金铁铸神兵',
    },
    {
      id: 'skill-support',
      name: '圣灵回生纹',
      type: 'manual',
      rank: '天品',
      quantity: 3,
      description: '圣灵回响，生机守护并存',
    },
  ],
  artifact: [
    {
      id: 'artifact-special-core',
      name: '末世审判甲核',
      type: 'tcdb',
      rank: '神品',
      quantity: 3,
      description: '神甲守护与爆裂裁决并生',
    },
    {
      id: 'artifact-ore-main',
      name: '玄岳神铁',
      type: 'ore',
      rank: '仙品',
      quantity: 3,
      description: '守护护甲与金铁锋芒兼备',
    },
    {
      id: 'artifact-monster',
      name: '狂魄兽壳',
      type: 'monster',
      rank: '天品',
      quantity: 3,
      description: '守御反震与爆裂兽魄共振',
    },
    {
      id: 'artifact-ore-sub',
      name: '裂岳寒晶',
      type: 'ore',
      rank: '仙品',
      quantity: 3,
      description: '寒盾守护，爆裂回响，坚壁如岳',
    },
    {
      id: 'artifact-special-sub',
      name: '审判圣纹',
      type: 'tcdb',
      rank: '天品',
      quantity: 3,
      description: '神圣守护爆裂符纹，裁决万法',
    },
  ],
  gongfa: [
    {
      id: 'gongfa-special-core',
      name: '飞升太虚残篇',
      type: 'tcdb',
      rank: '神品',
      quantity: 3,
      description: '太虚灵诀，守护飞升之卷，神意无相',
    },
    {
      id: 'gongfa-manual',
      name: '升灵古经',
      type: 'gongfa_manual',
      rank: '仙品',
      quantity: 3,
      description: '灵诀神卷，直指飞升大道',
    },
    {
      id: 'gongfa-herb',
      name: '回生仙草',
      type: 'herb',
      rank: '天品',
      quantity: 3,
      description: '生息复苏，灵元循环不绝',
    },
    {
      id: 'gongfa-ore',
      name: '镇界玄铁',
      type: 'ore',
      rank: '仙品',
      quantity: 3,
      description: '守护界域，太虚灵魄凝成壁垒',
    },
    {
      id: 'gongfa-special-sub',
      name: '无相圣印',
      type: 'tcdb',
      rank: '天品',
      quantity: 3,
      description: '神圣守护，太虚无相，飞升留印',
    },
  ],
};

const REQUESTED_HIGH_TIER_TAGS: Record<CreationProductType, string[]> = {
  skill: [
    CreationTags.MATERIAL.SEMANTIC_BURST,
    CreationTags.MATERIAL.SEMANTIC_BLADE,
    CreationTags.MATERIAL.SEMANTIC_FLAME,
    CreationTags.MATERIAL.SEMANTIC_MANUAL,
    CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
    CreationTags.MATERIAL.SEMANTIC_DIVINE,
    CreationTags.MATERIAL.TYPE_SPECIAL,
  ],
  artifact: [
    CreationTags.MATERIAL.SEMANTIC_GUARD,
    CreationTags.MATERIAL.SEMANTIC_BURST,
    CreationTags.MATERIAL.TYPE_SPECIAL,
  ],
  gongfa: [
    CreationTags.MATERIAL.SEMANTIC_GUARD,
    CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    CreationTags.MATERIAL.SEMANTIC_MANUAL,
    CreationTags.MATERIAL.TYPE_SPECIAL,
  ],
};

function withDeterministicRandom<T>(seed: number, execute: () => T): T {
  const originalRandom = Math.random;
  let state = seed >>> 0;

  if (state === 0) {
    state = 1;
  }

  Math.random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  try {
    return execute();
  } finally {
    Math.random = originalRandom;
  }
}

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length * ratio)];
}

function runCraftSample(
  productType: CreationProductType,
  materials: Material[],
  seed: number,
) {
  return withDeterministicRandom(seed, () => {
    const orchestrator = new TestableCreationOrchestrator();
    const session = orchestrator.createSession({
      productType,
      materials,
      requestedTags: REQUESTED_HIGH_TIER_TAGS[productType],
    });

    orchestrator.submitMaterials(session);
    orchestrator.analyzeMaterialsWithDefaults(session);
    orchestrator.resolveIntentWithDefaults(session);
    orchestrator.validateRecipeWithDefaults(session);

    if (session.state.failureReason) {
      return undefined;
    }

    orchestrator.budgetEnergyWithDefaults(session);
    orchestrator.buildAffixPoolWithDefaults(session);
    orchestrator.rollAffixesWithDefaults(session);

    const budget = session.state.energyBudget;
    if (!budget) {
      return undefined;
    }

    const slotCount = resolveAffixSlotCount(
      budget.initialRemaining ?? budget.remaining,
    );
    const selectedCategories = new Set(
      session.state.rolledAffixes.map((affix) => affix.category),
    );
    const HIGH_TIER = ['skill_rare', 'gongfa_secret', 'artifact_treasure'] as const;
    const CORE_POOL = ['skill_core', 'gongfa_foundation', 'artifact_panel'] as const;
    const highTierCount = session.state.rolledAffixes.filter((affix) =>
      (HIGH_TIER as readonly string[]).includes(affix.category),
    ).length;
    const nonCoreCount = session.state.rolledAffixes.filter(
      (affix) => !(CORE_POOL as readonly string[]).includes(affix.category),
    ).length;

    return {
      slotCount,
      selectedCategories,
      poolCategories: new Set(session.state.affixPool.map((affix) => affix.category)),
      fillRate: session.state.rolledAffixes.length / Math.max(1, slotCount),
      remaining: budget.remaining,
      highTierCount,
      nonCoreCount,
    };
  });
}

describe('actual affix registry distribution regression', () => {
  for (const productType of ['skill', 'artifact', 'gongfa'] as const) {
    it(`${productType} 高投入真实词缀池应保留高阶可达性且预算利用稳定`, () => {
      const samples = SEEDS.map((seed) =>
        runCraftSample(productType, HIGH_TIER_MATERIAL_SETS[productType], seed),
      ).filter((sample): sample is NonNullable<typeof sample> => Boolean(sample));

      expect(samples).toHaveLength(SEEDS.length);
      expect(samples.every((sample) => sample.slotCount === 5)).toBe(true);
      const highTierCategory = ({ skill: 'skill_rare', artifact: 'artifact_treasure', gongfa: 'gongfa_secret' } as const)[productType];
      expect(samples[0].poolCategories.has(highTierCategory)).toBe(true);
      expect(samples.some((sample) => sample.selectedCategories.has(highTierCategory))).toBe(true);

      const fillP50 = percentile(
        samples.map((sample) => sample.fillRate),
        0.5,
      );
      const nonCoreTotal = samples.reduce(
        (sum, sample) => sum + sample.nonCoreCount,
        0,
      );
      const highTierTotal = samples.reduce(
        (sum, sample) => sum + sample.highTierCount,
        0,
      );
      const highTierShare = highTierTotal / Math.max(1, nonCoreTotal);
      const fullFillRate =
        samples.filter((sample) => sample.fillRate === 1).length / samples.length;
      const highTierHitRate =
        samples.filter((sample) => sample.selectedCategories.has(highTierCategory)).length /
        samples.length;

      expect(fillP50).toBeGreaterThanOrEqual(0.55);
      expect(fullFillRate).toBeGreaterThanOrEqual(0);
      expect(highTierHitRate).toBeGreaterThanOrEqual(0.01);
      expect(highTierHitRate).toBeLessThanOrEqual(1);
      expect(highTierShare).toBeGreaterThanOrEqual(0.03);
      expect(highTierShare).toBeLessThanOrEqual(0.55);
    });
  }
});